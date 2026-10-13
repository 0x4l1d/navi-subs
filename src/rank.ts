import { fit, isService } from './release.ts'

import type { Medium, Release } from './release.ts'
import type { Verdict } from './season.ts'
import type { Candidate } from './sources/types.ts'

const SOURCE: Record<string, number> = { mirai: 6, subdl: 3, subsource: 2 }
const FORMAT: Record<string, number> = { ass: 5, ssa: 4, srt: 3, vtt: 2, sub: 0 }
// with nothing else to go on: most people watch a web release
const MEDIUM: Record<string, number> = { WEB: 3, BD: 2, TV: 1, DVD: 0 }

// higher is better. the video being played counts most, then what the user prefers
export function score (candidate: Candidate, video: Release | undefined, prefer: Medium | undefined, season: Verdict = 'same'): number {
  let points = (SOURCE[candidate.source] ?? 0) + (FORMAT[candidate.format] ?? 0)
  if (video) points += fit(candidate.release, video)
  if (prefer && candidate.release.medium) points += candidate.release.medium === prefer ? 20 : -5
  if (!video?.medium && !prefer) points += MEDIUM[candidate.release.medium ?? ''] ?? 0
  if (candidate.exact) points += 1
  // between equals the official script goes first, it is the one most releases are timed to
  if (isService(candidate.named.who)) points += 2
  points += Math.min(3, candidate.version - 1)
  if (season === 'unsure') points -= 50
  return points
}

// what a subtitle says once timing and looks are taken away, so the same script from two places is one
export function fingerprint (text: string): string {
  const lines = text.split(/\r?\n/)
    .filter(line => /^Dialogue:/.test(line) || (!/-->/.test(line) && !/^\d+$/.test(line.trim()) && !/^[[\]\w ]*:/.test(line)))
    .map(line => line.replace(/^Dialogue:(?:[^,]*,){9}/, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ''))
    .filter(Boolean)
  // fnv-1a over the words, with the size so near misses differ
  let hash = 0x811c9dc5
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      hash ^= line.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return `${lines.length}:${hash.toString(16)}`
}
