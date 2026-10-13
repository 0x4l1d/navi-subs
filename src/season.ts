// which season or part of a show a release is, and whether that is the one being looked for.
// no dependencies, the app uses it for torrent results and the engine for subtitles

import { splitBrackets } from './brackets.ts'

export interface Parsed {
  // the show's name with season and part words still in it
  title: string
  // the name without them
  base: string
  season?: number
  // several seasons in one release: [1, 3]
  seasons?: [number, number]
  part?: number
  final: boolean
  episodes?: [number, number]
  batch: boolean
}

const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7 }
const ROMAN: Record<string, number> = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6 }

// letters and digits only, so "SPY×FAMILY" meets "Spy x Family"
export const squash = (text: string) => text.normalize('NFKC').toLowerCase().replace(/×/g, 'x').replace(/[^\p{L}\p{N}]+/gu, '')

// "Seasons 1-3", "Season 1+2", "Season 1-3", "S01-S03". not "S2 - 01" or "Season 3 - 08", those are a
// season and an episode
const SEASON_RANGE = /\b(?:Seasons\s*0?(\d{1,2})\s*(?:-|~|to|&|\+)\s*0?(\d{1,2})|Season\s*0?(\d{1,2})\s*(?:to|&|\+|-(?=[1-9]\b)|(?:-|~|to|&|\+)\s*(?=Season))\s*(?:Season\s*)?0?(\d{1,2})|S0?(\d{1,2})\s*(?:-|~|&|\+)\s*S0?(\d{1,2}))\b/i
const SEASON_WORDS: RegExp[] = [
  /\bS(?:eason)?\s*0?(\d{1,2})(?=\s*E\d|\b)/i,
  /\bSeason\s+0?(\d{1,2})\b/i,
  /\b(\d{1,2})(?:st|nd|rd|th)\s+Season\b/i,
  /\b(first|second|third|fourth|fifth|sixth|seventh)\s+Season\b/i,
  /第\s*(\d{1,2})\s*期/
]
const PART_WORDS: RegExp[] = [
  /\b(?:Part|Cour)\s*0?(\d{1,2})\b/i,
  /\b(?:Part|Cour)\s+(ii|iii|iv)\b/i,
  /\b(\d)(?:st|nd|rd|th)\s+(?:Part|Cour)\b/i,
  /第\s*(\d)\s*クール/
]

const number = (text: string) => ORDINALS[text.toLowerCase()] ?? ROMAN[text.toLowerCase()] ?? Number(text)

function seasonIn (text: string): number | undefined {
  for (const pattern of SEASON_WORDS) {
    const m = pattern.exec(text)
    if (m) return number(m[1]!)
  }
  // "Mushoku Tensei II", "Overlord IV": a roman numeral on its own after the name
  const roman = /\S\s+(ii|iii|iv|vi|v)(?=\s*(?::|-|$|\())/i.exec(text)
  if (roman && !/\b(?:part|cour)\s+(?:ii|iii|iv|vi|v)\b/i.test(text)) return ROMAN[roman[1]!.toLowerCase()]
}

function partIn (text: string): number | undefined {
  for (const pattern of PART_WORDS) {
    const m = pattern.exec(text)
    if (m) return number(m[1]!)
  }
}

// the name without the words that say season or part
function baseOf (title: string): string {
  let text = title
  for (const pattern of [SEASON_RANGE, ...SEASON_WORDS, ...PART_WORDS]) text = text.replace(pattern, ' ')
  return text
    .replace(/\b(?:the\s+)?final\s+season\b/i, ' ')
    .replace(/(\S)\s+(?:ii|iii|iv|vi|v)(?=\s*(?::|-|$|\())/i, '$1')
    .replace(/\s+/g, ' ')
    .replace(/[\s:–-]+$/, '')
    .trim()
}

const EPISODE: RegExp[] = [
  // s02e05, s02e05-e06
  /\bS\d{1,2}\s*E(\d{1,4})(?:\s*-\s*E?(\d{1,4}))?\b/i,
  // " - 05", " - 01 ~ 12", " - 01-12"
  /\s-\s(\d{1,4})(?:v\d)?(?:\s*(?:~|-)\s*(\d{1,4}))?(?=\s|$|\[|\()/,
  // "E05", "EP05", "Episode 5"
  /\bE(?:p|pisode)?\s*(\d{1,4})\b/i,
  // "01 ~ 12" with no dash in front
  /\b(\d{1,4})\s*~\s*(\d{1,4})\b/
]

const VIDEO_EXT = /\.(?:mkv|mp4|avi|webm|m4v|ts|ass|srt|ssa|vtt|sub|zip|torrent)$/i

// reads a release or file name: "[Erai-raws] Spy x Family Part 2 - 01 [1080p].mkv"
export function parseName (raw: string): Parsed {
  const name = raw.replace(VIDEO_EXT, '').replaceAll('_', ' ')
  const { outside, groups } = splitBrackets(name)
  // scene names use dots for spaces, "5.1" and "v1.5" keep theirs
  // "Show Season 2 (S02) | Other Name": what follows the bar is the same show under another name
  const text = (/\s/.test(outside.trim()) ? outside : outside.replace(/\.(?!\d\b)/g, ' ')).split(/\s[|｜]\s/)[0]!.replace(/\s+/g, ' ').trim()

  let episodes: [number, number] | undefined
  let cut = text.length
  for (const pattern of EPISODE) {
    const m = pattern.exec(text)
    if (!m) continue
    const from = Number(m[1])
    const to = m[2] === undefined ? from : Number(m[2])
    if (to >= from) episodes = [from, to]
    cut = Math.min(cut, m.index)
    break
  }
  // numbers in brackets count when the name has none: "[05]", "(01-25)", "[EP: 01-12]". years don't
  if (!episodes) {
    const year = (n: string) => /^(?:19|20)\d\d$/.test(n)
    for (const group of groups) {
      const m = /^(?:E|EP|EP:|Episodes?)?\s*(\d{1,4})(?:v\d)?(?:\s*(?:-|~)\s*(\d{1,4}))?$/i.exec(group.trim()) ?? /\bEP:?\s*(\d{1,4})\s*(?:-|~)\s*(\d{1,4})\b/i.exec(group)
      if (!m || year(m[1]!) || (m[2] && year(m[2]))) continue
      const from = Number(m[1])
      const to = m[2] === undefined ? from : Number(m[2])
      if (to >= from) episodes = [from, to]
      break
    }
  }

  const range = SEASON_RANGE.exec(text) ?? groups.map(g => SEASON_RANGE.exec(g)).find(Boolean)
  const [from, to] = [Number(range?.[1] ?? range?.[3] ?? range?.[5]), Number(range?.[2] ?? range?.[4] ?? range?.[6])]
  const seasons: [number, number] | undefined = range && to > from ? [from, to] : undefined

  // the season can sit next to the episode ("S02E05") or in a bracket ("[Season 2]")
  // scene names run on into what the file is made of ("Show 1080p BluRay x265-GROUP"), the name stops there
  const tech = /\s(?:\d{3,4}p|\d{3,4}x\d{3,4}|blu-?ray|bd(?:rip|remux)?|web(?:-?dl|rip)?|hdtv|dvd(?:rip)?|remux|x26[45]|h\s?26[45]|hevc|av1|10-?bit|dual[\s-]?audio|multi(?:-?subs?)?|uncensored)(?=\s|$)/i.exec(text)
  if (tech && tech.index > 2) cut = Math.min(cut, tech.index)
  const title = text.slice(0, cut).replace(/[\s:–-]+$/, '').trim() || text
  const season = seasons ? undefined : seasonIn(text) ?? groups.map(seasonIn).find(n => n !== undefined)
  const part = partIn(text) ?? groups.map(partIn).find(n => n !== undefined)
  const words = `${text} ${groups.join(' ')}`

  return {
    title,
    base: baseOf(title),
    season,
    seasons,
    part,
    final: /\bfinal\s+season\b/i.test(text),
    episodes,
    batch: !!seasons || (!!episodes && episodes[1] > episodes[0]) || /\b(?:batch|complete|bd\s?box|全集)\b/i.test(words) || (!episodes && /\bS(?:eason)?\s*\d{1,2}\b/i.test(words))
  }
}

export interface Entry {
  titles: string[]
  episodes?: number | null
  format?: string | null
}

export interface Related extends Entry {
  relation: string
}

export interface Wanted {
  entry: Entry
  related: Related[]
  episode: number
  // the number counted through the whole series, when it differs
  absolute?: number | null
}

export type Verdict = 'same' | 'other' | 'unsure'

export interface Judged {
  verdict: Verdict
  why: string
}

const LONG = new Set(['TV', 'TV_SHORT', 'ONA'])
const clean = (titles: string[]) => titles.filter((t): t is string => !!t && t.trim().length > 0)

interface Known {
  keys: Set<string>
  bases: Set<string>
  season?: number
  part?: number
  final: boolean
}

function know (entry: Entry): Known {
  const parsed = clean(entry.titles).map(title => ({ title, season: seasonIn(title), part: partIn(title), base: baseOf(title), final: /\bfinal\s+season\b/i.test(title) }))
  return {
    keys: new Set(parsed.map(p => squash(p.title)).filter(k => k.length >= 2)),
    bases: new Set(parsed.map(p => squash(p.base)).filter(k => k.length >= 2)),
    season: parsed.map(p => p.season).find(n => n !== undefined),
    part: parsed.map(p => p.part).find(n => n !== undefined),
    final: parsed.some(p => p.final)
  }
}

const same: Judged = { verdict: 'same', why: '' }
const other = (why: string): Judged => ({ verdict: 'other', why })
const unsure = (why: string): Judged => ({ verdict: 'unsure', why })

// is this release the season and part that was asked for?
// 'other' only when sure. anything in doubt stays 'unsure' or 'same', so a right result is never hidden
export function judge (name: string | Parsed, wanted: Wanted): Judged {
  const got = typeof name === 'string' ? parseName(name) : name
  const mine = know(wanted.entry)
  const relatives = wanted.related.filter(r => r.relation === 'PREQUEL' || r.relation === 'SEQUEL' || r.relation === 'PARENT' || r.relation === 'SIDE_STORY' || r.relation === 'ALTERNATIVE').map(r => ({ ...r, known: know(r) }))
  const series = relatives.filter(r => r.relation === 'PREQUEL' || r.relation === 'SEQUEL')

  const key = squash(got.title)
  const base = squash(got.base)
  if (!key) return same

  // a pack of several seasons holds ours too
  if (got.seasons) return same

  const { episode, absolute } = wanted
  const single = got.episodes && got.episodes[0] === got.episodes[1] ? got.episodes[0] : undefined
  const counted = typeof absolute === 'number' && absolute > 0 && absolute !== episode ? absolute : undefined

  // a pack that says which episodes it holds, and ours is not one of them: "(38-50)" when looking for 1.
  // with a prequel the numbers may count through the series in a way not known here, so that stays open
  const sameShow = mine.bases.has(base) || series.some(r => r.known.bases.has(base))
  if (sameShow && got.episodes && got.episodes[1] > got.episodes[0] && LONG.has(wanted.entry.format ?? 'TV')) {
    const [from, to] = got.episodes
    const holds = (n: number | undefined) => n !== undefined && n >= from && n <= to
    const after = series.some(r => r.relation === 'PREQUEL' && LONG.has(r.format ?? 'TV'))
    if (!holds(episode) && !holds(counted)) return after && counted === undefined ? unsure(`episodes ${from}-${to}`) : other(`episodes ${from}-${to}`)
  }

  // the whole name is another entry's name and not ours
  const twin = relatives.find(r => r.known.keys.has(key))
  if (twin && !mine.keys.has(key)) {
    // a prequel's name with our series-wide number is how many groups number later parts ("Show - 13")
    if (twin.relation === 'PREQUEL' && counted !== undefined && got.episodes && counted >= got.episodes[0] && counted <= got.episodes[1]) return same
    // an episode the prequel never had is also counted through ("Final Season - 76")
    if (twin.relation === 'PREQUEL' && single !== undefined && twin.episodes && single > twin.episodes) return same
    if (twin.relation === 'PREQUEL' && got.batch && !got.episodes) {
      // a pack of the whole season holds every part of it
      const sibling = [...twin.known.bases].some(b => mine.bases.has(b))
      if (got.season !== undefined && mine.season !== undefined && got.season !== mine.season) return other(`season ${got.season}`)
      if (sibling && (mine.part ?? 1) > 1 && twin.known.season === mine.season) return same
      return unsure(`name of ${clean(twin.titles)[0]}`)
    }
    return other(`matches ${clean(twin.titles)[0]}`)
  }
  if (mine.keys.has(key) && !twin && got.season === undefined && got.part === undefined && (single === undefined || single === episode || single === counted || (counted === undefined && series.some(r => r.relation === 'PREQUEL')))) return same

  // not this show at all is somebody else's call, here only seasons are judged
  const mineBase = mine.bases.has(base)
  const kin = series.some(r => r.known.bases.has(base))
  if (!mineBase && !kin) {
    // our name with more behind it ("Show: Some Arc - 01") is likely a later season that goes by a name
    const longer = !got.batch && [...mine.bases].some(b => b.length >= 5 && base.startsWith(b) && base.length - b.length >= 4)
    return longer && LONG.has(wanted.entry.format ?? 'TV') ? unsure('longer name') : same
  }

  // which season the entry is. no number in its names and no tv prequel means the first
  const hasPrequel = series.some(r => r.relation === 'PREQUEL' && LONG.has(r.format ?? 'TV'))
  const mySeason = mine.season ?? (hasPrequel ? undefined : 1)
  // parts exist when a relative with the same base name says "Part 2", then no word means the first
  const parted = series.some(r => r.known.part !== undefined && [...r.known.bases].some(b => mine.bases.has(b)))
  const myPart = mine.part ?? (parted ? 1 : undefined)

  if (got.season !== undefined) {
    if (mySeason !== undefined && got.season !== mySeason) return other(`season ${got.season}`)
    if (mySeason === undefined) {
      // our names carry no number. a relative that does carry this one owns it
      const owner = series.find(r => r.known.season === got.season)
      if (owner) return other(`season ${got.season}`)
    }
  } else if (mySeason !== undefined && mySeason > 1 && !got.final) {
    // no season in the name while ours is a later one: the first season, unless it counts through the series
    if (counted !== undefined && got.episodes && counted >= got.episodes[0] && counted <= got.episodes[1]) return same
    if (single !== undefined && single === episode && counted !== undefined) return other('first season numbering')
    if (!mine.keys.has(key)) return unsure('no season in the name')
  }

  if (got.final !== mine.final && (got.final || mine.final) && got.season === undefined) {
    // "Final Season" against a plain season of the same show
    if (series.some(r => r.known.final === got.final)) return other(got.final ? 'final season' : 'earlier season')
    return unsure('final season')
  }

  if (got.part !== undefined) {
    if (myPart !== undefined && got.part !== myPart) return other(`part ${got.part}`)
    if (myPart === undefined) {
      const owner = series.find(r => r.known.part === got.part && [...r.known.bases].some(b => mine.bases.has(b)))
      if (owner) return other(`part ${got.part}`)
      if (got.part > 1) return unsure(`part ${got.part}`)
    }
  } else if (myPart !== undefined && myPart > 1) {
    // ours is a later part and the name says none: fine when it counts through the season
    if (counted !== undefined && got.episodes && counted >= got.episodes[0] && counted <= got.episodes[1]) return same
    if (got.batch) return same
    if (single !== undefined && single === episode) return unsure('no part in the name')
  }

  // an episode past the end of this entry is a later part numbered through
  const count = wanted.entry.episodes
  if (single !== undefined && count && single > count && single !== counted && LONG.has(wanted.entry.format ?? 'TV') && !got.batch) return unsure(`episode ${single} of ${count}`)

  // one episode, and not the one asked for. it is kept (the number may be read wrong) but never leads
  const first = !series.some(r => r.relation === 'PREQUEL' && LONG.has(r.format ?? 'TV'))
  if (mineBase && single !== undefined && single !== episode && single !== counted && (first || counted !== undefined) && LONG.has(wanted.entry.format ?? 'TV') && !got.batch) return unsure(`episode ${single}`)

  return same
}

// the files inside a torrent say it best: "Show S02E01.mkv"
export function judgeFiles (files: string[], wanted: Wanted): Judged | undefined {
  const videos = files.filter(file => /\.(?:mkv|mp4|avi|webm|m4v)$/i.test(file))
  if (!videos.length) return undefined
  const verdicts = videos.slice(0, 60).map(file => {
    const parsed = parseName(file.slice(file.replaceAll('\\', '/').lastIndexOf('/') + 1))
    // a folder often names the season when the file doesn't
    if (parsed.season === undefined && parsed.part === undefined) {
      const folder = parseName(file.replaceAll('\\', '/').split('/').slice(0, -1).join(' '))
      parsed.season = folder.season
      parsed.part = folder.part
    }
    return parsed.season === undefined && parsed.part === undefined && !parsed.final ? undefined : judge(parsed, wanted)
  }).filter((j): j is Judged => !!j)

  if (!verdicts.length) return undefined
  if (verdicts.some(j => j.verdict === 'same')) return same
  if (verdicts.every(j => j.verdict === 'other')) return verdicts[0]
  return undefined
}
