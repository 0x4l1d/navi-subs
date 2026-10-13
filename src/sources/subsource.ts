import { HttpError } from '../http.ts'
import { limiter } from '../limits.ts'
import { fit, parseRelease } from '../release.ts'
import { squash } from '../season.ts'
import { fits, getBytes, getJson, isMovie, searchTitles, seasonOf, unpack } from './shared.ts'
import { text } from './types.ts'

import type { Limiter } from '../limits.ts'
import type { Medium } from '../release.ts'
import type { Store } from '../store.ts'
import type { Ask, Candidate, Language, Source } from './types.ts'

// subsource.net, needs a personal key (your profile page there). 60 requests a minute, 7200 a day

const API = 'https://api.subsource.net/api/v1'
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

interface Movie {
  movieId?: number
  title?: string
  alternateTitle?: string
  type?: string
  season?: number | null
  subtitleCount?: number
}

interface Subtitle {
  subtitleId?: number
  releaseInfo?: string[] | string
  releaseType?: string | null
  files?: number
  contributors?: Array<{ displayname?: string }>
}

const MEDIA: Record<string, Medium> = { bluray: 'BD', bdrip: 'BD', web: 'WEB', webrip: 'WEB', 'web-dl': 'WEB', hdtv: 'TV', tv: 'TV', dvd: 'DVD', dvdrip: 'DVD' }

export function subsourceSource (): Source {
  let limit: Limiter | undefined
  const quota = (store: Store) => (limit ??= limiter(store, 'subsource', { perMinute: 50, perDay: 6000 }))

  async function call (ask: Ask, path: string, key: string): Promise<unknown> {
    if (!await quota(ask.store).take()) return undefined
    try {
      return await getJson(ask.query.fetch, `${API}${path}`, ask.clock, 'subsource', { 'X-API-Key': key })
    } catch (error) {
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) throw new Error('subsource did not accept the key, check it in settings')
      if (error instanceof HttpError && error.status === 404) return undefined
      throw error
    }
  }

  const rows = <T>(answer: unknown): T[] => {
    const data = (answer as { data?: unknown } | undefined)?.data
    return Array.isArray(data) ? data as T[] : []
  }

  // which of the site's entries is this show and season
  async function movieId (ask: Ask, key: string): Promise<number | undefined> {
    const { query, store } = ask
    const season = seasonOf(query)
    const movie = isMovie(query)
    const kept = `subsource:id:${query.anilistId}:${movie ? 'movie' : season}`
    const known = await store.get<number | null>(kept)
    if (known) return known.value ?? undefined

    const type = movie ? 'movie' : 'series'
    const wanted = new Set(query.titles.map(squash))
    const pick = (found: Movie[]) => {
      const fitting = found.filter(m => typeof m.movieId === 'number' && (movie ? m.type === 'movie' : m.type !== 'movie' && (m.season ?? season) === season))
      return fitting.find(m => wanted.has(squash(text(m.title))) || wanted.has(squash(text(m.alternateTitle)))) ?? (query.imdbId ? fitting[0] : undefined)
    }

    let found: Movie | undefined
    if (query.imdbId) found = pick(rows<Movie>(await call(ask, `/movies/search?searchType=imdb&imdb=${encodeURIComponent(query.imdbId)}&type=${type}${movie ? '' : `&season=${season}`}`, key)))
    for (const title of searchTitles(query).slice(0, 2)) {
      if (found) break
      found = pick(rows<Movie>(await call(ask, `/movies/search?searchType=text&q=${encodeURIComponent(title)}&type=${type}${movie ? '' : `&season=${season}`}`, key)))
    }

    store.set(kept, found?.movieId ?? null, found ? 30 * DAY : 12 * HOUR)
    return found?.movieId
  }

  async function list (ask: Ask, id: number, language: Language, key: string): Promise<Subtitle[]> {
    const kept = `subsource:list:${id}:${language.code}`
    const known = await ask.store.get<Subtitle[]>(kept)
    if (known) return known.value
    const found = rows<Subtitle>(await call(ask, `/subtitles?movieId=${id}&language=${language.subsource}&limit=100&sort=popular`, key))
    ask.store.set(kept, found, found.length ? 12 * HOUR : 3 * HOUR)
    return found
  }

  return {
    id: 'subsource',
    name: 'SubSource',
    origins: ['https://api.subsource.net'],
    free: false,
    ready: options => text(options.subsourceKey).length > 0,

    async search (ask) {
      const { query, store, clock } = ask
      const key = text(ask.options.subsourceKey)
      const id = await movieId(ask, key)
      if (!id) return

      const season = seasonOf(query)
      const video = query.fileName ? parseRelease(query.fileName) : undefined
      const names = (s: Subtitle) => (Array.isArray(s.releaseInfo) ? s.releaseInfo : [text(s.releaseInfo)]).filter(Boolean)

      for (const language of ask.languages) {
        const picked = (await list(ask, id, language, key))
          .filter(s => typeof s.subtitleId === 'number')
          .map(s => {
            // a subtitle can list several releases it fits
            const verdicts = names(s).map(name => fits(name, query, season))
            const match = verdicts.includes(true) ? 2 : verdicts.every(v => v === undefined) ? 1 : 0
            const best = video ? Math.max(0, ...names(s).map(name => fit(parseRelease(name), video))) : 0
            return { s, match, score: match * 100 + best }
          })
          // a movie has no episode to match
          .filter(({ match }) => match === 2 || (match === 1 && (isMovie(query) || query.episodeCount === 1)))
          .sort((a, b) => b.score - a.score)
          .slice(0, ask.max)

        await Promise.all(picked.map(async ({ s }) => {
          const kept = `subsource:sub:${s.subtitleId}:${query.seasonEpisode ?? query.episode}`
          let candidates = (await store.get<Candidate[]>(kept))?.value
          if (!candidates) {
            if (!await quota(store).take()) return
            const bytes = await getBytes(query.fetch, `${API}/subtitles/${s.subtitleId}/download`, clock, 'subsource', { 'X-API-Key': key })
            const release = names(s).find(name => fits(name, query, season)) ?? names(s)[0] ?? ''
            candidates = await unpack(bytes, { release, author: text(s.contributors?.[0]?.displayname) || undefined, medium: MEDIA[text(s.releaseType).toLowerCase()] }, query, 'subsource', 'SubSource', language)
            store.set(kept, candidates, 14 * DAY)
          }
          if (candidates.length) ask.found(candidates.map(c => ({ ...c, language })))
        }).map(p => p.catch((error: unknown) => { ask.failed(error) })))
      }
    }
  }
}
