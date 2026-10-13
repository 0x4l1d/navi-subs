import type { Format } from './subtitle.ts'

// one line of a subtitle with its times, in milliseconds
export interface Cue {
  start: number
  end: number
  // true for spoken lines. signs, songs and credits are placed by hand and say nothing about timing
  speech: boolean
}

// from this time on (in the subtitle's own clock) lines move by `offset`
export interface Shift {
  from: number
  offset: number
}

const assTime = (h: string, m: string, s: string, cs: string) => ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(cs.padEnd(3, '0').slice(0, 3))
const ASS_LINE = /^(Dialogue:\s*[^,]*,)(\d+):(\d\d):(\d\d)[.:](\d{1,3}),(\d+):(\d\d):(\d\d)[.:](\d{1,3}),([^,]*),((?:[^,]*,){5})(.*)$/
const SRT_LINE = /((?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3}))(\s*-->\s*)((?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3}))/

const NOT_SPEECH = /sign|song|kara|title|logo|credit|staff|insert|lyric|\bop\b|\bed\b|^op|^ed/i

// a line that is drawn, moved or pinned somewhere is a sign
const placed = (text: string) => /\\p[1-9]|\\pos\(|\\move\(|\\org\(|\\clip\(|\\k[of]?\d/.test(text)

export function parseCues (text: string, format: Format): Cue[] {
  const cues: Cue[] = []
  if (format === 'ass' || format === 'ssa') {
    for (const line of text.split(/\r?\n/)) {
      const m = ASS_LINE.exec(line)
      if (!m) continue
      const start = assTime(m[2]!, m[3]!, m[4]!, m[5]!)
      const end = assTime(m[6]!, m[7]!, m[8]!, m[9]!)
      const words = m[12]!.replace(/\{[^}]*\}/g, '').trim()
      cues.push({ start, end, speech: end > start && end - start <= 12_000 && words.length > 0 && !NOT_SPEECH.test(m[10]!) && !placed(m[12]!) })
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      const m = SRT_LINE.exec(line)
      if (!m) continue
      const start = assTime(m[2] ?? '0', m[3]!, m[4]!, m[5]!)
      const end = assTime(m[8] ?? '0', m[9]!, m[10]!, m[11]!)
      cues.push({ start, end, speech: end > start && end - start <= 12_000 })
    }
  }
  return cues.sort((a, b) => a.start - b.start)
}

const two = (n: number) => String(n).padStart(2, '0')

function split (ms: number) {
  const t = Math.max(0, Math.round(ms))
  return { h: Math.floor(t / 3_600_000), m: Math.floor(t / 60_000) % 60, s: Math.floor(t / 1000) % 60, ms: t % 1000 }
}

const offsetAt = (shifts: Shift[], time: number) => {
  let offset = 0
  for (const shift of shifts) {
    if (shift.from > time) break
    offset = shift.offset
  }
  return offset
}

// the same subtitle with its lines moved. a line keeps its length, the shift of its start moves both ends
export function retime (text: string, format: Format, shifts: Shift[]): string {
  const sorted = [...shifts].sort((a, b) => a.from - b.from)
  if (!sorted.some(shift => shift.offset !== 0)) return text

  if (format === 'ass' || format === 'ssa') {
    return text.replace(/^Dialogue:.*$/gm, line => {
      const m = ASS_LINE.exec(line)
      if (!m) return line
      const start = assTime(m[2]!, m[3]!, m[4]!, m[5]!)
      const end = assTime(m[6]!, m[7]!, m[8]!, m[9]!)
      const by = offsetAt(sorted, start)
      const stamp = (ms: number) => {
        const t = split(ms)
        return `${t.h}:${two(t.m)}:${two(t.s)}.${two(Math.floor(t.ms / 10))}`
      }
      return `${m[1]}${stamp(start + by)},${stamp(end + by)},${m[10]},${m[11]}${m[12]}`
    })
  }

  const comma = format === 'srt'
  return text.split(/\r?\n/).map(line => {
    const m = SRT_LINE.exec(line)
    if (!m) return line
    const start = assTime(m[2] ?? '0', m[3]!, m[4]!, m[5]!)
    const end = assTime(m[8] ?? '0', m[9]!, m[10]!, m[11]!)
    const by = offsetAt(sorted, start)
    const stamp = (ms: number) => {
      const t = split(ms)
      return `${two(t.h)}:${two(t.m)}:${two(t.s)}${comma ? ',' : '.'}${String(t.ms).padStart(3, '0')}`
    }
    return line.replace(m[0], `${stamp(start + by)}${m[6]}${stamp(end + by)}`)
  }).join(text.includes('\r\n') ? '\r\n' : '\n')
}
