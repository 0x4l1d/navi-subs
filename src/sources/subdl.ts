import { HttpError } from '../http.ts'
import { limiter } from '../limits.ts'
import { fit, parseRelease } from '../release.ts'
import { fits, getBytes, getJson, isMovie, searchTitles, seasonOf, unpack } from './shared.ts'
import { text } from './types.ts'

import type { Limiter } from '../limits.ts'
import type { Store } from '../store.ts'
import type { Ask, Candidate, Language, Source } from './types.ts'

// subdl.com, needs a free personal key (subdl.com/panel/api). about 2000 searches a day

const API = 'https://api.subdl.com/api/v1/subtitles'
const FILES = 'https://dl.subdl.com'
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

interface Item {
  release_name?: string
  name?: string
  author?: string
  url?: string
  season?: number
  episode?: number | null
  episode_from?: number | null
  episode_end?: number | null
  full_season?: boolean
}

interface Answer {
  status?: boolean
  error?: string
  subtitles?: Item[]
}

export function subdlSource (): Source {
  let limit: Limiter | undefined
  const quota = (store: Store) => (limit ??= limiter(store, 'subdl', { perMinute: 30, perDay: 1800 }))

  async function list (ask: Ask, language: Language, key: string): Promise<Item[]> {
    const { query, store, clock } = ask
    const season = seasonOf(query)
    const episode = query.seasonEpisode ?? query.episode
    const movie = isMovie(query)
    const kept = `subdl:list:${query.anilistId}:${movie ? 'movie' : `${season}x${episode}`}:${language.code}`
    const known = await store.get<Item[]>(kept)
    if (known) return known.value

    // an id is exact, a name is the fallback
    const who = query.imdbId ? `imdb_id=${encodeURIComponent(query.imdbId)}` : query.tmdbId ? `tmdb_id=${encodeURIComponent(String(query.tmdbId))}` : `film_name=${encodeURIComponent(searchTitles(query)[0] ?? query.titles[0] ?? '')}`
    const where = movie ? 'type=movie' : `type=tv&season_number=${season}&episode_number=${episode}`
    if (!await quota(store).take()) return []

    let answer: Answer
    try {
      answer = await getJson(query.fetch, `${API}?api_key=${encodeURIComponent(key)}&${who}&${where}&languages=${language.subdl}&subs_per_page=30`, clock, 'subdl') as Answer
    } catch (error) {
      // subdl says "nothing found" with an error status
      if (error instanceof HttpError && (error.status === 404 || error.status === 400)) answer = { subtitles: [] }
      else if (error instanceof HttpError && (error.status === 401 || error.status === 403)) throw new Error('subdl did not accept the key, check it in settings')
      else throw error
    }
    const items = Array.isArray(answer.subtitles) ? answer.subtitles.filter(item => text(item.url)) : []
    // an empty answer is kept shorter, something may be uploaded tomorrow
    store.set(kept, items, items.length ? DAY : 3 * HOUR)
    return items
  }

  return {
    id: 'subdl',
    name: 'SubDL',
    origins: ['https://api.subdl.com', FILES],
    free: false,
    ready: options => text(options.subdlKey).length > 0,

    async search (ask) {
      const { query, store, clock } = ask
      const key = text(ask.options.subdlKey)
      const season = seasonOf(query)
      const video = query.fileName ? parseRelease(query.fileName) : undefined

      for (const language of ask.languages) {
        const items = (await list(ask, language, key))
          .filter(item => {
            const name = text(item.release_name) || text(item.name)
            // the site's own numbers first, then the name
            if (typeof item.season === 'number' && item.season > 0 && item.season !== season && !isMovie(query)) return false
            return fits(name, query, season) !== false
          })
          // the ones timed for this video first, packs of a whole season last
          .map(item => ({ item, score: (video ? fit(parseRelease(text(item.release_name)), video) : 0) - (item.full_season ? 20 : 0) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, ask.max)

        await Promise.all(items.map(async ({ item }) => {
          const url = text(item.url)
          const kept = `subdl:sub:${url}:${query.seasonEpisode ?? query.episode}`
          let candidates = (await store.get<Candidate[]>(kept))?.value
          if (!candidates) {
            const bytes = await getBytes(query.fetch, url.startsWith('http') ? url : `${FILES}${url.startsWith('/') ? '' : '/'}${url}`, clock, 'subdl')
            candidates = await unpack(bytes, { release: text(item.release_name) || text(item.name), author: text(item.author) || undefined }, query, 'subdl', 'SubDL', language)
            store.set(kept, candidates, 14 * DAY)
          }
          if (candidates.length) ask.found(candidates.map(c => ({ ...c, language })))
        }).map(p => p.catch((error: unknown) => { ask.failed(error) })))
      }
    }
  }
}
