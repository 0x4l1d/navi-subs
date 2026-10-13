// lines up one subtitle with another that is known to fit the video (the track inside the file),
// the way alass does: one delay for the whole file, or several where the releases differ
// (an opening cut differently, an ad break, an end card)

import type { Shift } from './cues.ts'

export interface Span {
  start: number
  end: number
}

export type SyncStatus =
  // lines were moved
  | 'synced'
  // it already fits, nothing to do
  | 'insync'
  // not enough to go on, or no clear answer: the timing is left alone
  | 'unsure'

export interface Synced {
  status: SyncStatus
  shifts: Shift[]
  // how well the subtitle's lines meet the reference's, 0 to 1: as it came, and after moving
  before: number
  after: number
  // what any two unrelated subtitles would score. a fit has to stand clear of this to mean something
  chance: number
  // how much of the reference there was to compare with
  lines: number
  seconds: number
}

export interface SyncOptions {
  // the furthest a subtitle may be off, in ms
  reach?: number
  // what a change of delay costs, in lines. higher means fewer splits
  splitCost?: number
}

const STEP = 10

// the reference as two running sums over 10ms steps: how much speech, and how many line starts nearby
function raster (ref: Span[], length: number) {
  const size = Math.ceil(length / STEP) + 2
  const speech = new Uint8Array(size)
  const starts = new Uint8Array(size)
  for (const { start, end } of ref) {
    const from = Math.max(0, Math.floor(start / STEP))
    const to = Math.min(size - 1, Math.ceil(end / STEP))
    for (let i = from; i < to; i++) speech[i] = 1
    // a start within 80ms counts as the same start
    for (let i = Math.max(0, from - 8); i <= Math.min(size - 1, from + 8); i++) starts[i] = 1
  }
  const sum = (bits: Uint8Array) => {
    const out = new Int32Array(size + 1)
    for (let i = 0; i < size; i++) out[i + 1] = out[i]! + bits[i]!
    return out
  }
  return { speech: sum(speech), starts, size }
}

// stretches of the video the reference covers. embedded lines arrive as the video is read, so parts
// of it may still be blank, and a blank part proves nothing
function regions (ref: Span[]): Span[] {
  const out: Span[] = []
  for (const { start, end } of ref) {
    const last = out[out.length - 1]
    if (last && start - last.end < 45_000) last.end = Math.max(last.end, end + 4000)
    else out.push({ start: start - 4000, end: end + 4000 })
  }
  return out
}

// releases of one episode differ in a few places at most. more pieces than this is not a fit, it is
// the search bending an unrelated subtitle into shape
const MAX_PARTS = 4

export function align (sub: Span[], reference: Span[], { reach = 150_000, splitCost = 12 }: SyncOptions = {}): Synced {
  const ref = [...reference].filter(s => s.end > s.start).sort((a, b) => a.start - b.start)
  const lines = [...sub].filter(s => s.end > s.start).sort((a, b) => a.start - b.start)
  const known = regions(ref)
  const seconds = Math.round(known.reduce((total, r) => total + (r.end - r.start - 8000), 0) / 1000)
  const nothing: Synced = { status: 'unsure', shifts: [], before: 0, after: 0, chance: 0, lines: ref.length, seconds }
  if (ref.length < 12 || lines.length < 12) return nothing

  const length = Math.max(ref[ref.length - 1]!.end, lines[lines.length - 1]!.end) + reach + 1000
  const { speech, starts, size } = raster(ref, length)
  const inside = (time: number) => known.some(r => time >= r.start && time <= r.end)

  // how well one line fits when moved by `offset`: the share of it over speech, plus a bit for a matching start
  const gain = (line: Span, offset: number) => {
    const from = Math.floor((line.start + offset) / STEP)
    const to = Math.ceil((line.end + offset) / STEP)
    if (to <= 0 || from >= size) return 0
    const a = Math.max(0, from)
    const b = Math.min(size, to)
    const share = (speech[b]! - speech[a]!) / Math.max(1, to - from)
    return share + (from >= 0 && from < size && starts[from] ? 0.5 : 0)
  }
  const total = (set: Span[], offset: number) => {
    let sum = 0
    for (const line of set) sum += gain(line, offset)
    return sum
  }
  // the best delay for a set of lines: every 100ms first, then every 10ms around the winner
  const best = (set: Span[]) => {
    let top = { offset: 0, score: -1 }
    for (let offset = -reach; offset <= reach; offset += 100) {
      const score = total(set, offset)
      if (score > top.score) top = { offset, score }
    }
    const around = top.offset
    for (let offset = around - 150; offset <= around + 150; offset += STEP) {
      const score = total(set, offset)
      if (score > top.score) top = { offset, score }
    }
    return top
  }

  // delays worth trying: the one for the whole file, the ones stretches of it like best, and none at all
  const whole = best(lines)
  const offsets = [0, whole.offset]
  const propose = (part: Span[]) => {
    if (part.length < 8 || offsets.length >= 16) return
    const { offset, score } = best(part)
    // only stretches that really fit somewhere add a candidate
    if (score / part.length > 1.05 && !offsets.some(o => Math.abs(o - offset) <= 60)) offsets.push(offset)
  }
  // releases differ where nobody speaks (opening, ad break, end card), so the stretches between long
  // silences are tried on their own, then a window sliding over the lines
  let first = 0
  for (let i = 1; i <= lines.length; i++) {
    if (i < lines.length && lines[i]!.start - lines[i - 1]!.end < 20_000) continue
    propose(lines.slice(first, i))
    first = i
  }
  const WINDOW = 16
  for (let i = 0; i + WINDOW <= lines.length; i += WINDOW / 2) propose(lines.slice(i, i + WINDOW))

  // cheapest path through the lines: each takes one of the delays, changing delay costs `splitCost`
  const K = offsets.length
  let cost = offsets.map(o => -gain(lines[0]!, o))
  const from: Int8Array[] = []
  for (let i = 1; i < lines.length; i++) {
    let low = 0
    for (let k = 1; k < K; k++) if (cost[k]! < cost[low]!) low = k
    const next = new Array<number>(K)
    const back = new Int8Array(K)
    for (let k = 0; k < K; k++) {
      const stay = cost[k]!
      const jump = cost[low]! + splitCost
      back[k] = stay <= jump ? k : low
      next[k] = Math.min(stay, jump) - gain(lines[i]!, offsets[k]!)
    }
    from.push(back)
    cost = next
  }
  let state = 0
  for (let k = 1; k < K; k++) if (cost[k]! < cost[state]!) state = k
  const picked = new Array<number>(lines.length)
  for (let i = lines.length - 1; i >= 0; i--) {
    picked[i] = state
    if (i > 0) state = from[i - 1]![state]!
  }

  // runs of the same delay. a run of a few lines between two longer ones is noise
  let runs: Array<{ k: number, first: number, count: number }> = []
  for (let i = 0; i < lines.length; i++) {
    const last = runs[runs.length - 1]
    if (last && last.k === picked[i]) last.count++
    else runs.push({ k: picked[i]!, first: i, count: 1 })
  }
  for (let pass = 0; pass < 4 && runs.length > 1; pass++) {
    const merged: typeof runs = []
    for (const run of runs) {
      const last = merged[merged.length - 1]
      if (last && (run.count < 10 || last.k === run.k)) last.count += run.count
      else merged.push({ ...run })
    }
    if (merged.length > 1 && merged[0]!.count < 10) {
      merged[1]!.first = merged[0]!.first
      merged[1]!.count += merged[0]!.count
      merged.shift()
    }
    if (merged.length === runs.length) break
    runs = merged
  }

  // a stretch only keeps a delay of its own when its lines really meet the reference there. one that
  // doesn't (past the part of the video read so far, or just noise) goes along with the stretch before it
  const fitOf = (run: { k: number, first: number, count: number }) => {
    let sum = 0
    for (let i = run.first; i < run.first + run.count; i++) sum += gain(lines[i]!, offsets[run.k]!)
    return sum / run.count
  }
  const kept: typeof runs = []
  for (const run of runs) {
    const last = kept[kept.length - 1]
    if (last && (fitOf(run) < 0.95 || last.k === run.k)) last.count += run.count
    else kept.push({ ...run })
  }
  if (kept.length > 1 && fitOf(kept[0]!) < 0.95) {
    kept[1]!.first = kept[0]!.first
    kept[1]!.count += kept[0]!.count
    kept.shift()
  }
  runs = kept

  const shifts: Shift[] = runs.map((run, i) => ({ from: i === 0 ? 0 : lines[run.first]!.start, offset: offsets[run.k]! }))
  const moved = (line: Span) => {
    let offset = 0
    for (const shift of shifts) {
      if (shift.from > line.start) break
      offset = shift.offset
    }
    return offset
  }

  // only lines that land where the reference has something to say are counted
  const share = (offsetOf: (line: Span) => number) => {
    let hit = 0
    let count = 0
    for (const line of lines) {
      const offset = offsetOf(line)
      if (!inside(line.start + offset)) continue
      count++
      hit += gain(line, offset) / 1.5
    }
    return { share: count ? hit / count : 0, count }
  }
  const before = share(() => 0)
  const after = share(moved)

  // the same measure at delays that mean nothing, the middle one is what chance gives
  const random: number[] = []
  for (let offset = -reach; offset <= reach; offset += 1700) {
    const at = share(() => offset)
    if (at.count >= 12) random.push(at.share)
  }
  random.sort((a, b) => a - b)
  const chance = random.length ? random[Math.floor(random.length / 2)]! : 0
  const result = { before: before.share, after: after.share, chance, lines: ref.length, seconds }

  if (after.count < 12) return { ...nothing, ...result }
  // a real fit is far from chance: the lines of the right episode land on the reference's lines, the
  // lines of another episode only brush them
  const fits = (value: number) => value - chance >= 0.25 && value >= 0.7
  // already fits, or the best there is moves nothing
  if (shifts.every(shift => Math.abs(shift.offset) < 60)) return { status: fits(before.share) ? 'insync' : 'unsure', shifts: [], ...result }
  if (fits(before.share) && after.share - before.share < 0.04) return { status: 'insync', shifts: [], ...result }
  // moving has to fit clearly better than both chance and the timing it came with, or nothing is moved
  if (!fits(after.share) || after.share - before.share < 0.06 || shifts.length > MAX_PARTS) return { status: 'unsure', shifts: [], ...result }
  return { status: 'synced', shifts, ...result }
}
