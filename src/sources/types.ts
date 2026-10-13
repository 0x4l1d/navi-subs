import type { Clock } from '../clock.ts'
import type { Named } from '../label.ts'
import type { Release } from '../release.ts'
import type { Store } from '../store.ts'
import type { Format } from '../subtitle.ts'
import type { Options, SubtitleQuery } from '../types.ts'

// one language the engine can ask for. more can be added here, each source says what it calls it
export interface Language {
  code: string
  name: string
  subdl: string
  subsource: string
  // mirai is an arabic site
  mirai: boolean
}

export const LANGUAGES: Record<string, Language> = {
  ar: { code: 'ar', name: 'Arabic', subdl: 'AR', subsource: 'arabic', mirai: true },
  en: { code: 'en', name: 'English', subdl: 'EN', subsource: 'english', mirai: false },
  fr: { code: 'fr', name: 'French', subdl: 'FR', subsource: 'french', mirai: false },
  es: { code: 'es', name: 'Spanish', subdl: 'ES', subsource: 'spanish', mirai: false },
  tr: { code: 'tr', name: 'Turkish', subdl: 'TR', subsource: 'turkish', mirai: false },
  id: { code: 'id', name: 'Indonesian', subdl: 'ID', subsource: 'indonesian', mirai: false }
}

// one subtitle file, ready to show
export interface Candidate {
  source: string
  language: Language
  text: string
  format: Format
  named: Named
  release: Release
  // the file name it came from
  name: string
  // bits that tell two files from one place apart
  tags: string[]
  version: number
  // made for this one episode, not picked out of a batch
  exact: boolean
}

export interface Ask {
  query: SubtitleQuery
  options: Options
  languages: Language[]
  clock: Clock
  store: Store
  // most files worth reading from one source
  max: number
  // hand files over as they come, the answer may leave before the source is done
  found: (candidates: Candidate[]) => void
  // something went wrong on the way but there may still be results. the next call tries again
  failed: (error: unknown) => void
}

export interface Source {
  id: string
  name: string
  // sites it talks to, the app switches cors on for them
  origins: string[]
  // true when it can run with these options (a key is there, a language it has)
  ready: (options: Options, languages: Language[]) => boolean
  search: (ask: Ask) => Promise<void>
  // only free sources are worth asking ahead of time
  free: boolean
}

export const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
export const on = (value: unknown, fallback: boolean) => value === undefined || value === null || value === '' ? fallback : value !== false && value !== 'false' && value !== 0
