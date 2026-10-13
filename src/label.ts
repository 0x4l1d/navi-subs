import { fullName, isVideoGroup } from './release.ts'

import type { Medium } from './release.ts'
import type { Format } from './subtitle.ts'

export interface Named {
  // who made the subtitle, already in full
  who: string
  medium?: Medium | string
  // the video group it was timed for
  video?: string
}

// file names can't carry these, and hayase reads the label as one
const tidy = (text: string) => text.replace(/[\\/:*?"<>|\p{Cc}]/gu, ' ').replace(/\s+/g, ' ').trim()

// "Arabic - Crunchyroll & Almighty (BD · DBD-Raws)": who made it, then the release it was timed for.
// hayase takes the type after the last dot, so it ends in the extension
export function label (named: Named, format: Format, language = 'Arabic', extra = ''): string {
  const release = [named.medium, named.video].filter(Boolean).join(' · ')
  return `${tidy(`${language} - ${named.who.slice(0, 60)}${release ? ` (${release})` : ''}${extra ? ` ${extra}` : ''}`)}.${format}`
}

// the page lists who translated, the file name may know better
export function nameOf (file: { group?: string, video?: string, medium?: Medium, mixed: boolean }, page: { translators: string[], release: string }, fallback: string): Named {
  const credited = page.translators.map(fullName).join(' & ')
  // a lone video group in the name is what it was timed for, not who translated it
  const lone = !file.video && file.group && isVideoGroup(file.group) ? file.group : undefined
  const group = lone ? undefined : file.group && fullName(file.group)
  // in a mixed zip the file name knows who made this one, the page just lists everyone
  const who = (file.mixed ? group ?? credited : credited || group) || fallback
  // the page can list several releases (BD/WEB), the name of the file settles it
  const medium = file.medium ?? page.release.split('/').map(part => part.trim()).filter(Boolean).join(', ')
  return { who, medium: medium || undefined, video: file.video ?? lone }
}

// same label twice gets a 2 on the second one
export function unique (names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map(name => {
    const n = (seen.get(name) ?? 0) + 1
    seen.set(name, n)
    const dot = name.lastIndexOf('.')
    return n === 1 ? name : `${name.slice(0, dot)} ${n}${name.slice(dot)}`
  })
}
