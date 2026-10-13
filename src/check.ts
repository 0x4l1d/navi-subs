// is this subtitle for the episode being played? two cheap signs: how long it runs, and whether its
// lines fall where the video's own subtitle track has lines

import type { Cue } from './cues.ts'
import type { Synced } from './sync.ts'

// 'maybe' is shown with a mark, 'wrong' is dropped
export type EpisodeCheck = 'ok' | 'maybe' | 'wrong'

const MINUTE = 60_000

// the last spoken line has to fit inside the video, and not stop far short of its end
export function checkLength (cues: Cue[], videoSeconds: number | undefined): EpisodeCheck {
  const spoken = cues.filter(cue => cue.speech)
  if (!videoSeconds || !Number.isFinite(videoSeconds) || spoken.length < 5) return 'ok'
  const video = videoSeconds * 1000
  const last = Math.max(...spoken.map(cue => cue.end))

  // lines after the video is over: a longer cut, a double episode, another episode
  if (last > video + 3 * MINUTE) return 'wrong'
  if (last > video + 45_000) return 'maybe'
  // a full episode whose subtitle stops before the half is likely another, shorter thing
  if (video > 10 * MINUTE && spoken.length >= 20) {
    if (last < video * 0.3) return 'wrong'
    if (last < video * 0.5) return 'maybe'
  }
  return 'ok'
}

// after lining up with the video's own track: lines that still don't meet its lines are from somewhere else.
// only said with enough of the reference to compare with
export function checkPattern (synced: Synced | undefined): EpisodeCheck {
  if (!synced || synced.lines < 40 || synced.seconds < 200) return 'ok'
  // the right episode meets most of the video's own lines even when it is timed by another hand.
  // another episode meets about half of them at best, however it is moved around
  if (synced.after < 0.6 && synced.lines >= 60 && synced.seconds >= 300) return 'wrong'
  if (synced.after < 0.7) return 'maybe'
  return 'ok'
}

export const worst = (...checks: EpisodeCheck[]): EpisodeCheck => checks.includes('wrong') ? 'wrong' : checks.includes('maybe') ? 'maybe' : 'ok'
