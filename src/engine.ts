import { cache } from './cache.ts'
import { SlowError, startClock } from './clock.ts'
import { BlockedError, DownError } from './http.ts'
import { label, unique } from './label.ts'
import { fingerprint, score } from './rank.ts'
import { parseRelease } from './release.ts'
import { judge } from './season.ts'
import { miraiSource } from './sources/mirai.ts'
import { subdlSource } from './sources/subdl.ts'
import { subsourceSource } from './sources/subsource.ts'
import { LANGUAGES, on, text } from './sources/types.ts'
import { defaultStore } from './store.ts'

import type { Medium } from './release.ts'
import type { Verdict, Wanted } from './season.ts'
import type { Candidate, Language, Source } from './sources/types.ts'
import type { Store } from './store.ts'
import type { Format } from './subtitle.ts'
import type { MediaLike, Options, SubtitleQuery } from './types.ts'

export interface Found {
  // the same for the same script, wherever it came from
  id: string
  source: string
  sourceName: string
  // the track's name, it ends in the file type
  label: string
  language: string
  text: string
  format: Format
  who: string
  medium?: string
  video?: string
  name: string
  score: number
  // 'unsure' is shown with a mark, 'other' never gets this far unless hiding is off
  season: Verdict
}

export interface Answer {
  results: Found[]
  // true when a source was still working as the answer left. `done` has the rest
  pending: boolean
  done: Promise<Found[]>
}

// how a source did the last time it was asked. the app shows this next to the source's own settings
export interface SourceStatus {
  ok: boolean
  // how many files it handed over
  found: number
  // what went wrong, as a kind the app can put into words
  problem?: 'blocked' | 'key' | 'down' | 'slow' | 'limit' | 'other'
  at: number
}

function problemOf (error: unknown): SourceStatus['problem'] {
  if (error instanceof BlockedError) return 'blocked'
  if (error instanceof DownError) return 'down'
  if (error instanceof SlowError) return 'slow'
  if (error instanceof Error && /did not accept the key/.test(error.message)) return 'key'
  return 'other'
}

export interface EngineOptions {
  store?: Store
  sources?: Source[]
  // answer by then with what there is, hayase gives up at 10s
  budget?: number
  // let a source go on this long in the background, so opening again finds it ready
  patience?: number
  // once something is in, the rest get this much longer
  grace?: number
}

const MINUTE = 60 * 1000
const asError = (reason: unknown) => reason instanceof Error ? reason : new Error(String(reason))

const names = (title: MediaLike['title'], synonyms: MediaLike['synonyms']) => [title?.romaji, title?.english, title?.native, title?.userPreferred, ...(synonyms ?? [])].filter((t): t is string => !!t)

// what the season check needs to know, from the anilist entry hayase hands over
export function wantedOf (query: SubtitleQuery): Wanted {
  const media = query.media
  return {
    entry: { titles: [...new Set([...query.titles, ...names(media?.title, media?.synonyms)])], episodes: media?.episodes ?? query.episodeCount, format: media?.format },
    related: (media?.relations?.edges ?? []).flatMap(edge => edge?.node && edge.relationType ? [{ relation: edge.relationType, titles: names(edge.node.title, edge.node.synonyms), episodes: edge.node.episodes, format: edge.node.format }] : []),
    episode: query.episode,
    absolute: query.absoluteEpisodeNumber
  }
}

export function languagesOf (options: Options): Language[] {
  const codes = (text(options.languages) || 'ar').split(/[,\s]+/).map(code => code.toLowerCase())
  const found = codes.map(code => LANGUAGES[code]).filter((l): l is Language => !!l)
  return found.length ? found : [LANGUAGES.ar!]
}

const preferOf = (options: Options): Medium | undefined => {
  const value = text(options.release).toUpperCase()
  return value === 'BD' || value === 'WEB' || value === 'TV' ? value : undefined
}

export function maxFiles (options: Options): number {
  return Math.min(8, Math.max(1, Math.round(Number(options.maxFiles) || 3)))
}

export const defaultSources = (): Source[] => [miraiSource(), subdlSource(), subsourceSource()]

export function createEngine ({ store = defaultStore(), sources = defaultSources(), budget = 8000, patience = 25_000, grace = 1500 }: EngineOptions = {}) {
  // an answer is kept a while: opening the episode again is instant, and a search that was still
  // running when the first answer left is joined, not started over
  const runs = cache<Run>(30 * MINUTE, 24)

  interface Run {
    candidates: Candidate[]
    errors: unknown[]
    // a source got through but something on the way failed
    soft: unknown[]
    open: number
    all: Promise<void>
    // called every time something comes in or a source ends
    wake: Array<() => void>
  }

  const statuses = new Map<string, SourceStatus>()

  const active = (options: Options, languages: Language[]) => sources.filter(source => on(options[source.id], true) && source.ready(options, languages))

  function start (query: SubtitleQuery, options: Options, only?: (source: Source) => boolean): Run {
    const languages = languagesOf(options)
    const picked = active(options, languages).filter(source => !only || only(source))
    const run: Run = { candidates: [], errors: [], soft: [], open: picked.length, all: Promise.resolve(), wake: [] }
    const poke = () => { for (const wake of run.wake.splice(0)) wake() }

    run.all = Promise.all(picked.map(async source => {
      let found = 0
      let trouble: unknown
      try {
        await source.search({
          query,
          options,
          languages,
          store,
          clock: startClock(patience, source.id),
          max: maxFiles(options) + 2,
          found: candidates => {
            found += candidates.length
            run.candidates.push(...candidates)
            poke()
          },
          failed: error => {
            trouble ??= error
            // only the free source is asked again because of this, a keyed one would spend searches
            if (source.free) run.soft.push(error)
          }
        })
      } catch (error) {
        trouble = error
        // one broken site never takes the others down. an optional source that fails does so quietly:
        // its trouble is kept for its own settings and is never shown as an error
        if (source.free) run.errors.push(error)
      } finally {
        statuses.set(source.id, { ok: !trouble || found > 0, found, problem: trouble && !found ? problemOf(trouble) : undefined, at: Date.now() })
        run.open--
        poke()
      }
    })).then(() => undefined)
    return run
  }

  function keyOf (query: SubtitleQuery, options: Options): string {
    const sourcesKey = sources.map(s => `${s.id}:${on(options[s.id], true) && s.ready(options, languagesOf(options)) ? 1 : 0}`).join(',')
    return [query.anilistId, query.malId ?? '', query.episode, query.absoluteEpisodeNumber ?? '', query.seasonEpisode ?? '', query.episodeCount ?? '', query.media?.format ?? '', query.titles[0] ?? '', maxFiles(options), text(options.languages), sourcesKey].join('|')
  }

  // candidates in the order they should be shown
  function arrange (candidates: Candidate[], query: SubtitleQuery, options: Options): Found[] {
    const video = query.fileName ? parseRelease(query.fileName) : undefined
    const prefer = preferOf(options)
    const wanted = wantedOf(query)
    const hide = on(options.hideOtherSeasons, true)

    const best = new Map<string, { candidate: Candidate, points: number, season: Verdict }>()
    candidates.forEach(candidate => {
      // mirai's pages are one per entry, so a file from there is the right season already
      const season = candidate.source === 'mirai' ? 'same' : judge(candidate.name, wanted).verdict
      if (season === 'other' && hide) return
      const points = score(candidate, video, prefer, season === 'other' ? 'unsure' : season)
      const id = `${candidate.language.code}:${fingerprint(candidate.text)}`
      const had = best.get(id)
      if (!had || points > had.points) best.set(id, { candidate, points, season })
    })

    // equal points keep one order whatever arrived first
    const ranked = [...best.entries()].sort((a, b) => b[1].points - a[1].points || a[1].candidate.named.who.localeCompare(b[1].candidate.named.who) || a[0].localeCompare(b[0]))
    const plain = ranked.map(([, { candidate }]) => label(candidate.named, candidate.format, candidate.language.name))
    // two files that would read the same get the tags only one of them has
    const labels = unique(ranked.map(([, { candidate }], i) => {
      const alike = ranked.filter((_, j) => plain[j] === plain[i]).map(([, r]) => r.candidate)
      if (alike.length < 2) return plain[i]!
      const extra = candidate.tags.filter(tag => alike.some(other => !other.tags.includes(tag))).join(' ')
      return label(candidate.named, candidate.format, candidate.language.name, extra)
    }))

    return ranked.map(([id, { candidate, points, season }], i) => ({
      id,
      source: candidate.source,
      sourceName: sources.find(s => s.id === candidate.source)?.name ?? candidate.source,
      label: labels[i]!,
      language: candidate.language.code,
      text: candidate.text,
      format: candidate.format,
      who: candidate.named.who,
      medium: candidate.named.medium,
      video: candidate.named.video,
      name: candidate.name,
      score: points,
      season
    }))
  }

  // waits until the run is done, or it has something and the grace is up, or the time is up
  function settle (run: Run, ms: number): Promise<void> {
    return new Promise(resolve => {
      let graceTimer: ReturnType<typeof setTimeout> | undefined
      let over = false
      const finish = () => {
        over = true
        clearTimeout(deadline)
        clearTimeout(graceTimer)
        resolve()
      }
      const deadline = setTimeout(finish, ms)
      const check = () => {
        if (over) return
        if (!run.open) return finish()
        if (run.candidates.length) graceTimer ??= setTimeout(finish, grace)
        run.wake.push(check)
      }
      check()
    })
  }

  // the next episode is read ahead from the free sources, so it opens at once. keyed sources are left
  // alone, their searches are counted
  function ahead (query: SubtitleQuery, options: Options) {
    const count = query.episodeCount ?? query.media?.episodes
    if (count && query.episode >= count) return
    const next: SubtitleQuery = {
      ...query,
      episode: query.episode + 1,
      absoluteEpisodeNumber: typeof query.absoluteEpisodeNumber === 'number' ? query.absoluteEpisodeNumber + 1 : query.absoluteEpisodeNumber,
      seasonEpisode: typeof query.seasonEpisode === 'number' ? query.seasonEpisode + 1 : query.seasonEpisode,
      fileName: undefined
    }
    const key = `ahead|${keyOf(next, options)}`
    if (runs.get(key) || runs.get(keyOf(next, options))) return
    runs.set(key, start(next, options, source => source.free), 5 * MINUTE)
  }

  return {
    sources,

    // sites the app has to allow requests to
    origins: () => [...new Set(sources.flatMap(source => source.origins))],

    async find (query: SubtitleQuery, options: Options = {}): Promise<Answer> {
      const key = keyOf(query, options)
      let run = runs.get(key)
      // a finished run where something failed is not the answer to keep, the next call tries again.
      // what did work is remembered by the sources, so that costs little
      if (run && !run.open && (run.errors.length || run.soft.length)) run = undefined
      run ??= runs.set(key, start(query, options))

      await settle(run, budget)
      const current = run
      const results = arrange(current.candidates, query, options)
      const pending = current.open > 0

      if (!pending && !results.length) {
        // slow is not worth an error, a site that is down or blocked is
        const failure = current.errors.find(error => !(error instanceof SlowError))
        if (failure) throw asError(failure)
      }

      const done = current.all.then(() => arrange(current.candidates, query, options))
      if (on(options.ahead, true)) done.then(() => ahead(query, options)).catch(() => undefined)
      return { results, pending, done }
    },

    // how each source did the last time it ran
    status: (id: string) => statuses.get(id),

    // which of the keyed sources are switched on, for the settings page
    ready: (options: Options) => active(options, languagesOf(options)).map(source => source.id)
  }
}

export type Engine = ReturnType<typeof createEngine>
