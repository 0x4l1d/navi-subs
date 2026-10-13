import { flat, splitBrackets } from './brackets.ts'

// what a subtitle was timed for, or what a video is
export type Medium = 'BD' | 'WEB' | 'TV' | 'DVD'

export interface Release {
  medium?: Medium
  // the group that made the video
  group?: string
  // lines of the picture, 1080 for 1080p
  resolution?: number
}

const MEDIA: Array<[Medium, RegExp]> = [
  ['BD', /(?:^|[^a-z])(?:bd(?:rip|remux|mv)?|blu-?ray|bdmv)(?![a-z])/i],
  ['DVD', /(?:^|[^a-z])(?:dvd(?:rip|iso|5|9)?|r2j?)(?![a-z])/i],
  ['WEB', /(?:^|[^a-z])(?:web(?:[ ._-]?(?:dl|rip))?|cr|nf|amzn|dsnp|hidive|b-global|bilibili|crunchyroll|netflix|amazon)(?![a-z])/i],
  ['TV', /(?:^|[^a-z])(?:tv(?:rip)?|hdtv|at-x|tokyo ?mx|bs11)(?![a-z])/i]
]

export function mediumOf (text: string): Medium | undefined {
  for (const [medium, pattern] of MEDIA) if (pattern.test(text)) return medium
}

// short names subbers and the site use for where a script came from
const NAMES: Record<string, string> = {
  cr: 'Crunchyroll',
  nf: 'Netflix',
  amzn: 'Amazon',
  amz: 'Amazon',
  dsnp: 'Disney+',
  dsny: 'Disney+',
  hidive: 'HIDIVE',
  hdv: 'HIDIVE',
  bili: 'Bilibili',
  'b-global': 'Bilibili',
  bglobal: 'Bilibili',
  adn: 'ADN',
  funi: 'Funimation',
  hulu: 'Hulu',
  abema: 'ABEMA',
  unext: 'U-NEXT',
  atvp: 'Apple TV+',
  iq: 'iQIYI',
  iqiyi: 'iQIYI',
  baha: 'Bahamut',
  wkn: 'Wakanim',
  vrv: 'VRV',
  muse: 'Muse'
}

const SERVICES = new Set(Object.values(NAMES).map(name => name.toLowerCase()))

// an official script from a streaming service, not a fan translation
export const isService = (who: string) => who.split(/\s*[&+,،]\s*/).some(part => SERVICES.has(part.trim().toLowerCase()))

// "Cr & Nf" reads "Crunchyroll & Netflix", names that are already whole stay as they are
export function fullName (name: string): string {
  return name.split(/(\s*[&+,،]\s*)/).map(part => NAMES[part.trim().toLowerCase()] ?? part).join('')
}

// groups that put out video, not arabic subtitles. a subtitle file that carries one of these was timed for it
const VIDEO_GROUP = /raws?$|^(?:subsplease|erai-raws|horriblesubs|judas|ember|asw|vcb-studio|reinforce|moozzi2|beatrice-raws|commie|kametsu|sallysubs|anime ?time|yameii|toonshub|varyg|sugoi|neohevc|cleo|dkb|trix|bluray|lostyears|smc|ctr|arid|chihiro|gjm|doki|coalgirls|thora|philosophy-raws|hi10|sxales|tenrai-sensei|nan0|okay-subs|mtbb|kawaiika-raws|hatsuyuki|df68|iahq|lazyremux|pmr|zza|tsundere-raws|new-raws|anime land)$/i

export const isVideoGroup = (name: string) => VIDEO_GROUP.test(name.trim())

const RESOLUTION = /(?:^|[^\d])(?:\d{3,4}x)?(2160|1440|1080|810|720|576|540|480|360)[pi]?(?![\d])/i

export function resolutionOf (text: string): number | undefined {
  const m = RESOLUTION.exec(text)
  return m ? Number(m[1]) : undefined
}

// what a video file name says about itself: "[SubsPlease] Show - 05 (1080p) [ABCD1234].mkv"
export function parseRelease (fileName: string): Release {
  const base = fileName.slice(fileName.replaceAll('\\', '/').lastIndexOf('/') + 1).replace(/\.(?:mkv|mp4|avi|webm|m4v|ts|ass|srt|ssa|vtt|sub|zip)$/i, '')
  const { outside, groups } = splitBrackets(base)

  // fansubs lead with [Group], scene names end in -GROUP
  const first = base.trimStart().startsWith('[') ? groups[0] : undefined
  const tail = /-([A-Za-z][\w.]{1,24})$/.exec(outside.trim())?.[1]
  const group = (first && !resolutionOf(first) && !mediumOf(flat(first)) ? first : undefined) ?? (tail && !/^\d+$/.test(tail) ? tail : undefined)

  return { medium: mediumOf(base.replace(/[._]/g, ' ')), group, resolution: resolutionOf(base) }
}

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '')

// how well a subtitle's release fits the video, higher is better. a clash of bd and tv counts against it
export function fit (sub: Release, video: Release): number {
  let score = 0
  if (same(sub.group, video.group)) score += 25
  if (sub.medium && video.medium) score += sub.medium === video.medium ? 30 : -15
  if (sub.resolution && sub.resolution === video.resolution) score += 3
  return score
}
