import { noClock } from '../clock.ts'
import { request } from '../http.ts'
import { fullName, isVideoGroup, mediumOf, parseRelease } from '../release.ts'
import { describe, pickFiles } from '../names.ts'
import { parseName, squash } from '../season.ts'
import { decodeText, detectFormat } from '../subtitle.ts'
import { zipFromBytes } from '../zip.ts'

import type { Clock } from '../clock.ts'
import type { Medium } from '../release.ts'
import type { SubtitleQuery } from '../types.ts'
import type { Candidate, Language } from './types.ts'

// the season the tv databases file this entry under: navi's hint, else what the names say, else the first
export function seasonOf (query: SubtitleQuery): number {
  if (typeof query.season === 'number' && query.season > 0) return query.season
  for (const title of query.titles) {
    const season = parseName(title).season
    if (season) return season
  }
  return 1
}

export const isMovie = (query: SubtitleQuery) => query.media?.format === 'MOVIE' || (query.episodeCount === 1 && query.media?.format !== 'TV')

// titles a text search copes with: latin letters, longest words first dropped
export function searchTitles (query: SubtitleQuery): string[] {
  const seen = new Set<string>()
  return query.titles.filter(title => {
    const key = squash(parseName(title).base)
    if (key.length < 3 || seen.has(key) || /[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(title)) return false
    seen.add(key)
    return true
  }).map(title => parseName(title).base || title)
}

// does a release name fit the wanted episode? undefined when it says nothing
export function fits (name: string, query: SubtitleQuery, season: number): boolean | undefined {
  const parsed = parseName(name)
  if (parsed.season !== undefined && parsed.season !== season && !parsed.seasons) return false
  if (!parsed.episodes) return undefined
  const [from, to] = parsed.episodes
  const absolute = query.absoluteEpisodeNumber
  const hit = (n: number | null | undefined) => typeof n === 'number' && n >= from && n <= to
  return hit(query.seasonEpisode) || hit(query.episode) || hit(absolute)
}

export interface Pack {
  // a release name the site gave for the pack
  release: string
  // who uploaded or made it, when the site says
  author?: string
  medium?: Medium
}

// a downloaded archive (or a bare subtitle file) turned into candidates for this episode
export async function unpack (bytes: Uint8Array, pack: Pack, query: SubtitleQuery, source: string, fallback: string, language: Language): Promise<Candidate[]> {
  const episodes = [query.seasonEpisode ?? query.episode, query.absoluteEpisodeNumber ?? undefined].filter((n): n is number => typeof n === 'number')
  const wanted: [number | undefined, number | undefined] = [episodes[0], episodes[1] !== episodes[0] ? episodes[1] : undefined]
  const files: Array<{ name: string, text: string }> = []

  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (isZip) {
    const zip = await zipFromBytes(bytes)
    const names = zip.entries.map(e => e.name)
    // one file packs are for the episode the site says, bigger ones are picked by name
    const lone = names.filter(n => describe(n) !== undefined).length === 1 || parseName(pack.release).episodes !== undefined
    for (const picked of pickFiles(names, wanted, lone).filter(p => p.format !== 'zip').slice(0, 3)) {
      const entry = zip.entries.find(e => e.name === picked.path)!
      try {
        files.push({ name: picked.path.slice(picked.path.lastIndexOf('/') + 1), text: decodeText(await zip.read(entry, noClock)) })
      } catch {
        // one bad entry doesn't spoil the pack
      }
    }
  } else {
    files.push({ name: pack.release, text: decodeText(bytes) })
  }

  const out: Candidate[] = []
  for (const file of files) {
    const format = detectFormat(file.text)
    if (!format) continue
    const described = describe(file.name.includes('.') ? file.name : `${file.name}.${format}`)
    // the pack's release name knows the video, the file's own name may know better
    const fromFile = parseRelease(file.name)
    const fromPack = parseRelease(pack.release)
    const video = described?.video ?? (fromFile.group && isVideoGroup(fromFile.group) ? fromFile.group : fromPack.group)
    const group = described?.group && !isVideoGroup(described.group) ? described.group : undefined
    const medium = described?.medium ?? fromFile.medium ?? fromPack.medium ?? pack.medium ?? mediumOf(pack.release)

    out.push({
      source,
      language,
      text: file.text,
      format,
      named: { who: fullName(group ?? pack.author ?? fallback), medium, video },
      release: { medium, group: video, resolution: fromFile.resolution ?? fromPack.resolution },
      name: file.name,
      tags: described?.tags ?? [],
      version: described?.version ?? 1,
      exact: !isZip || files.length === 1
    })
  }
  return out
}

export async function getJson (fetchFn: typeof fetch, url: string, clock: Clock, who: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await request(fetchFn, url, clock, headers, who)
  return await clock.run(res.json() as Promise<unknown>)
}

export async function getBytes (fetchFn: typeof fetch, url: string, clock: Clock, who: string, headers?: Record<string, string>): Promise<Uint8Array> {
  const res = await request(fetchFn, url, clock, headers, who)
  return new Uint8Array(await clock.run(res.arrayBuffer()))
}

// base64 so bytes fit in the json store
export function pack64 (bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
