// the bits of hayase's extension api we use, plus what navi adds. plain hayase leaves the extras out

interface Title {
  romaji?: string | null
  english?: string | null
  native?: string | null
  userPreferred?: string | null
}

export interface MediaLike {
  idMal?: number | null
  format?: string | null
  episodes?: number | null
  title?: Title | null
  synonyms?: Array<string | null> | null
  relations?: {
    edges?: Array<{
      relationType?: string | null
      node?: { format?: string | null, episodes?: number | null, title?: Title | null, synonyms?: Array<string | null> | null } | null
    } | null> | null
  } | null
}

export interface SubtitleQuery {
  anilistId: number
  malId?: number | null
  anidbAid?: number | null
  imdbId?: string | null
  tmdbId?: string | number | null
  tvdbId?: number | null
  episode: number
  episodeCount?: number
  absoluteEpisodeNumber?: number | null
  titles: string[]
  media?: MediaLike
  // navi: the playing video's file name, subtitles timed for that release go first
  fileName?: string
  // navi: the season and episode the tv databases use
  season?: number | null
  seasonEpisode?: number | null
  // on ios this is a proxy: no response headers, no body stream
  fetch: typeof fetch
}

export type Options = Record<string, string | number | boolean | null | undefined>

export interface SubtitleResult {
  url: string
  language: string
}
