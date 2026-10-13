import { cache } from '../cache.ts'
import { startClock } from '../clock.ts'
import { readPicked } from '../files.ts'
import { getText, HttpError, ORIGIN, request } from '../http.ts'
import { nameOf } from '../label.ts'
import { parseListing } from '../listing.ts'
import { pickFiles } from '../names.ts'
import { plan } from '../plan.ts'
import { resolutionOf } from '../release.ts'
import { findSlug, slugCache } from '../resolve.ts'
import { openZip, SkippedEntry } from '../zip.ts'

import type { Clock } from '../clock.ts'
import type { Read } from '../files.ts'
import type { Block } from '../listing.ts'
import type { Step } from '../plan.ts'
import type { Store } from '../store.ts'
import type { SubtitleQuery } from '../types.ts'
import type { Zip } from '../zip.ts'
import type { Ask, Candidate, Language, Source } from './types.ts'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// a zip this small comes whole in one request, a round trip costs more than the extra bytes
const WHOLE = 300 * 1024

const asError = (reason: unknown) => reason instanceof Error ? reason : new Error(String(reason))
const gone = (error: unknown) => error instanceof HttpError && (error.status === 404 || error.status === 410)

// the page gives slugs percent encoded, the rest api gives them plain
const urlSafe = (slug: string) => /%[\da-f]{2}/i.test(slug) ? slug : encodeURIComponent(slug)

// what is kept of a read file, enough to build the candidate again
interface Kept {
  text: string
  format: Read['format']
  name: string
  group?: string
  video?: string
  medium?: Read['file']['medium']
  mixed: boolean
  tags: string[]
  version: number
}

export function miraiSource (): Source {
  const slugs = slugCache()
  const listings = cache<{ blocks: Block[], at: number }>(10 * MINUTE, 64)
  const zips = cache<Zip>(30 * MINUTE, 12)
  const found = cache<Kept[]>(30 * MINUTE, 32)

  // the page of a show never moves, so it is kept for a month. a miss is asked again after a few hours
  async function slugOf (query: SubtitleQuery, clock: Clock, store: Store): Promise<string | undefined> {
    const key = `mirai:slug:${query.anilistId}`
    const kept = query.anilistId ? await store.get<string | null>(key) : undefined
    if (kept) return kept.value ?? undefined

    const slug = await findSlug(query, clock, slugs)
    if (query.anilistId) store.set(key, slug ?? null, slug ? 30 * DAY : 6 * HOUR)
    return slug
  }

  async function fetchListing (slug: string, fetchFn: typeof fetch, clock: Clock, store: Store) {
    let blocks: Block[]
    try {
      blocks = parseListing(await getText(fetchFn, `${ORIGIN}/subtitle/${urlSafe(slug)}/`, clock))
    } catch (error) {
      // the anime is on the site, nobody uploaded subs yet
      if (!gone(error)) throw error
      blocks = []
    }
    store.set(`mirai:list:${slug}`, blocks, blocks.length ? 7 * DAY : 30 * MINUTE)
    return listings.set(slug, { blocks, at: Date.now() }, blocks.length ? undefined : 5 * MINUTE)
  }

  // a kept listing answers at once. it is asked again when it has nothing for this episode, or in the
  // background once it is a few hours old
  async function steps (slug: string, ask: Ask): Promise<Step[]> {
    const { query, options, clock, store } = ask
    const kept = listings.get(slug) ?? await store.get<Block[]>(`mirai:list:${slug}`).then(hit => hit && listings.set(slug, { blocks: hit.value, at: hit.at }))
    if (!kept) return plan((await fetchListing(slug, query.fetch, clock, store)).blocks, query, options)

    const age = Date.now() - kept.at
    const planned = plan(kept.blocks, query, options)
    if (!planned.length && age > 10 * MINUTE) return plan((await fetchListing(slug, query.fetch, clock, store)).blocks, query, options)
    if (age > 6 * HOUR) fetchListing(slug, query.fetch, startClock(20_000), store).catch(() => undefined)
    return planned
  }

  async function fromZip ({ block, episodes, lone, span }: Step, ask: Ask, language: Language): Promise<{ candidates: Candidate[], failed?: unknown }> {
    const { query, clock, store } = ask
    const key = `${block.zip}|${episodes.join(',')}`
    const build = (kept: Kept[]) => kept.map(k => candidate(k, block, language, lone))

    const known = found.get(key) ?? (await store.get<Kept[]>(`mirai:sub:${key}`))?.value
    if (known) return { candidates: build(found.set(key, known)) }

    const tail = block.size && block.size <= WHOLE ? Math.ceil(block.size * 1.1) + 1024 : undefined
    const zip = zips.get(block.zip) ?? zips.set(block.zip, await openZip(query.fetch, block.zip, clock, tail))
    const picked = pickFiles(zip.entries.map(e => e.name), episodes, lone, span)

    const reads = await Promise.allSettled(picked.map(file => readPicked(zip, file, clock)))
    const files = reads.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    // too big or locked stays that way, nothing to retry or report
    const failed = reads.find((r): r is PromiseRejectedResult => r.status === 'rejected' && !(r.reason instanceof SkippedEntry))
    if (failed && !files.length) throw asError(failed.reason)

    const kept: Kept[] = files.map(({ file, text, format }) => ({ text, format, name: file.path.slice(file.path.lastIndexOf('/') + 1), group: file.group, video: file.video, medium: file.medium, mixed: file.mixed, tags: file.tags, version: file.version }))
    // a failed read may work next time, so only clean runs are kept
    if (!failed) {
      found.set(key, kept)
      store.set(`mirai:sub:${key}`, kept, 14 * DAY)
    }
    return { candidates: build(kept), failed: failed?.reason }
  }

  function candidate (kept: Kept, block: Block, language: Language, exact: boolean): Candidate {
    const named = nameOf(kept, block, 'Mirai')
    return {
      source: 'mirai',
      language,
      text: kept.text,
      format: kept.format,
      named,
      release: { medium: kept.medium ?? (/^(?:BD|WEB|TV|DVD)$/.test(block.release) ? block.release as 'BD' : undefined), group: named.video, resolution: resolutionOf(kept.tags.join(' ')) },
      name: kept.name,
      tags: kept.tags,
      version: kept.version,
      exact
    }
  }

  return {
    id: 'mirai',
    name: 'Mirai Anime',
    origins: [ORIGIN],
    free: true,
    ready: (_, languages) => languages.some(l => l.mirai),

    async search (ask) {
      const language = ask.languages.find(l => l.mirai)!
      const slug = await slugOf(ask.query, ask.clock, ask.store)
      if (!slug) return

      const planned = await steps(slug, ask)
      const errors: unknown[] = []
      let any = false
      await Promise.all(planned.map(async step => {
        try {
          const { candidates, failed } = await fromZip(step, ask, language)
          if (failed) ask.failed(failed)
          if (candidates.length) {
            any = true
            ask.found(candidates)
          }
        } catch (error) {
          errors.push(error)
          if (!gone(error)) ask.failed(error)
        }
      }))

      if (!any) {
        // a gone zip is no news, anything else is worth telling
        const failure = errors.find(error => !gone(error))
        if (failure) throw asError(failure)
      }
    }
  }
}

export async function testMirai (): Promise<boolean> {
  const clock = startClock(4000)
  const res = await request(fetch, `${ORIGIN}/wp-json/wp/v2/anime?per_page=1&_fields=id`, clock)
  if (!Array.isArray(await clock.run(res.json()))) throw new Error('mirai answered something unexpected')
  return true
}
