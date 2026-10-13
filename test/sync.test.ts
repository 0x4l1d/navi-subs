import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { checkLength, checkPattern, worst } from '../src/check.ts'
import { parseCues, retime } from '../src/cues.ts'
import { align } from '../src/sync.ts'

import type { Cue } from '../src/cues.ts'
import type { Span } from '../src/sync.ts'

// the same numbers every run
function random (seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// speech the way an episode has it: bursts of lines, pauses, a silent opening between 1:30 and 3:00
function episode (seed: number, minutes = 24): Span[] {
  const next = random(seed)
  const spans: Span[] = []
  let t = 2000
  while (t < minutes * 60_000 - 5000) {
    if (t > 90_000 && t < 180_000) { t = 180_000 + next() * 3000; continue }
    const length = 900 + next() * 3200
    spans.push({ start: Math.round(t), end: Math.round(t + length) })
    t += length + (next() < 0.3 ? 2500 + next() * 9000 : 150 + next() * 1500)
  }
  return spans
}

// a translation of the same script: same lines, a little off at each end, a few merged or missing
function translated (ref: Span[], seed: number): Span[] {
  const next = random(seed)
  const out: Span[] = []
  for (let i = 0; i < ref.length; i++) {
    const line = ref[i]!
    if (next() < 0.04) continue
    if (next() < 0.06 && ref[i + 1]) {
      out.push({ start: line.start, end: ref[i + 1]!.end })
      i++
      continue
    }
    out.push({ start: Math.round(line.start + (next() - 0.5) * 120), end: Math.round(line.end + (next() - 0.5) * 160) })
  }
  return out
}

const move = (spans: Span[], pick: (time: number) => number) => spans.map(s => ({ start: s.start + pick(s.start), end: s.end + pick(s.start) }))
// what a line would be moved by
const shiftAt = (shifts: Array<{ from: number, offset: number }>, time: number) => shifts.filter(s => s.from <= time).at(-1)?.offset ?? 0

const ref = episode(7)

test('a constant delay is found and undone', () => {
  for (const delay of [2300, -1750, 12_400, -31_000]) {
    const sub = move(translated(ref, 11), () => delay)
    const got = align(sub, ref)
    assert.equal(got.status, 'synced', `delay ${delay}`)
    assert.equal(got.shifts.length, 1)
    assert.ok(Math.abs(got.shifts[0]!.offset + delay) <= 60, `delay ${delay} came out as ${got.shifts[0]!.offset}`)
    assert.ok(got.after - got.chance > 0.3 && got.after > got.before)
  }
})

test('a subtitle that already fits is left alone', () => {
  const got = align(translated(ref, 12), ref)
  assert.equal(got.status, 'insync')
  assert.deepEqual(got.shifts, [])
})

test('a tv subtitle on a bd video: one delay before the opening, another after it', () => {
  // the bd has a longer opening: everything after 3:00 sits 5.2s later in the video than in the subtitle
  const sub = move(translated(ref, 13), time => time < 180_000 ? -800 : -6000)
  const got = align(sub, ref)
  assert.equal(got.status, 'synced')
  assert.equal(got.shifts.length, 2)
  assert.ok(Math.abs(shiftAt(got.shifts, 30_000) - 800) <= 60)
  assert.ok(Math.abs(shiftAt(got.shifts, 600_000) - 6000) <= 60)
  // the change sits in the silent gap, no line is moved the wrong way
  assert.ok(got.shifts[1]!.from > 80_000 && got.shifts[1]!.from < 185_000, String(got.shifts[1]!.from))
  assert.ok(got.after - got.chance > 0.3)
})

test('an ad break in the middle and an end card: three stretches', () => {
  const sub = move(translated(ref, 14), time => time < 180_000 ? 1500 : time < 720_000 ? -3500 : -18_500)
  const got = align(sub, ref)
  assert.equal(got.status, 'synced')
  assert.equal(got.shifts.length, 3)
  assert.ok(Math.abs(shiftAt(got.shifts, 60_000) + 1500) <= 60)
  assert.ok(Math.abs(shiftAt(got.shifts, 400_000) - 3500) <= 60)
  assert.ok(Math.abs(shiftAt(got.shifts, 1_000_000) - 18_500) <= 60)
})

test('with only the first minutes of the video read, it syncs on what is there', () => {
  const sub = move(translated(ref, 15), () => 4200)
  const early = ref.filter(s => s.end < 6 * 60_000)
  const got = align(sub, early)
  assert.equal(got.status, 'synced')
  assert.ok(Math.abs(got.shifts[0]!.offset + 4200) <= 60)
  assert.ok(got.seconds < 6 * 60 + 10)

  // more of the video arrives, the answer holds and now covers the rest
  const more = align(sub, ref.filter(s => s.end < 15 * 60_000))
  assert.equal(more.status, 'synced')
  assert.ok(more.seconds > got.seconds)
})

test('a handful of lines is not enough to move anything', () => {
  const sub = move(translated(ref, 16), () => 3000)
  const got = align(sub, ref.slice(0, 8))
  assert.equal(got.status, 'unsure')
  assert.deepEqual(got.shifts, [])
})

test('another episode never gets "synced": the timing is left alone and it is called out', () => {
  const stranger = episode(99)
  const got = align(stranger, ref)
  assert.notEqual(got.status, 'synced')
  assert.deepEqual(got.shifts, [])
  assert.ok(got.after - got.chance < 0.14)
  assert.notEqual(checkPattern(got), 'ok')

  // the right episode, however delayed, passes
  assert.equal(checkPattern(align(move(translated(ref, 17), () => -7000), ref)), 'ok')
  // too little of the reference to say anything
  assert.equal(checkPattern(align(stranger, ref.slice(0, 20))), 'ok')
})

test('retiming moves ass and srt lines, and only where told', () => {
  const ass = '[Events]\r\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\r\nDialogue: 0,0:00:10.00,0:00:12.50,Default,,0,0,0,,one, two\r\nDialogue: 0,0:05:00.00,0:05:02.00,Default,,0,0,0,,{\\an8}three\r\nComment: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,note\r\n'
  const moved = retime(ass, 'ass', [{ from: 0, offset: 1500 }, { from: 200_000, offset: -4000 }])
  assert.ok(moved.includes('Dialogue: 0,0:00:11.50,0:00:14.00,Default,,0,0,0,,one, two'))
  assert.ok(moved.includes('Dialogue: 0,0:04:56.00,0:04:58.00,Default,,0,0,0,,{\\an8}three'))
  assert.ok(moved.includes('Comment: 0,0:00:01.00'))
  assert.equal(retime(ass, 'ass', []), ass)

  const srt = '1\n00:00:10,000 --> 00:00:12,500\none\n\n2\n00:05:00,000 --> 00:05:02,000\ntwo\n'
  assert.equal(retime(srt, 'srt', [{ from: 0, offset: -11_000 }]), '1\n00:00:00,000 --> 00:00:01,500\none\n\n2\n00:04:49,000 --> 00:04:51,000\ntwo\n')
})

test('cues are read from ass and srt, signs and songs are not speech', () => {
  const ass = [
    'Dialogue: 0,0:00:10.00,0:00:12.50,Default,,0,0,0,,hello',
    'Dialogue: 0,0:00:13.00,0:00:15.00,Signs,,0,0,0,,{\\pos(100,200)}shop',
    'Dialogue: 0,0:00:16.00,0:00:18.00,Default,,0,0,0,,{\\pos(100,200)}placed',
    'Dialogue: 0,0:01:30.00,0:03:00.00,OP,,0,0,0,,la la',
    'Dialogue: 0,0:03:10.00,0:03:11.00,Default,,0,0,0,,{\\an8}'
  ].join('\n')
  const cues = parseCues(ass, 'ass')
  assert.deepEqual(cues.map(c => c.speech), [true, false, false, false, false])
  assert.deepEqual([cues[0]!.start, cues[0]!.end], [10_000, 12_500])
  assert.deepEqual(parseCues('1\n00:00:01,000 --> 00:00:02,500\nhi\n', 'srt'), [{ start: 1000, end: 2500, speech: true }])
  assert.deepEqual(parseCues('WEBVTT\n\n00:01.000 --> 00:02.500\nhi\n', 'vtt'), [{ start: 1000, end: 2500, speech: true }])
})

test('the length check: a subtitle has to fit the video', () => {
  const cues = (lastMinute: number): Cue[] => Array.from({ length: 200 }, (_, i) => ({ start: i * lastMinute * 300, end: i * lastMinute * 300 + 2000, speech: true }))
  assert.equal(checkLength(cues(23), 24 * 60), 'ok')
  // a 24 minute subtitle on a 12 minute short
  assert.equal(checkLength(cues(23), 12 * 60), 'wrong')
  // a minute and a half past the end: maybe a different cut
  assert.equal(checkLength(cues(25.5), 24 * 60), 'maybe')
  // stops at a third of the video
  assert.equal(checkLength(cues(8), 24 * 60), 'maybe')
  assert.equal(checkLength(cues(4), 24 * 60), 'wrong')
  // no length known, or too few lines: nothing is said
  assert.equal(checkLength(cues(23), undefined), 'ok')
  assert.equal(checkLength(cues(23).slice(0, 3), 60), 'ok')
  assert.equal(worst('ok', 'maybe'), 'maybe')
  assert.equal(worst('maybe', 'wrong', 'ok'), 'wrong')
})

// line times of real subtitles (no text): the official script and fan translations of two shows
const real = JSON.parse(readFileSync(new URL('./fixtures/timings.json', import.meta.url), 'utf8')) as Record<string, number[][]>
const spans = (name: string, until = Infinity): Span[] => real[name]!.map(([start, end]) => ({ start: start!, end: end! })).filter(s => s.end < until)

test('real subtitles: a fan translation of the right episode is never called wrong', () => {
  for (const [sub, ref] of [['spy1-fan-a', 'spy1-official'], ['spy1-fan-b', 'spy1-official'], ['csm1-fan', 'csm1-official']] as const) {
    for (const minutes of [5, 24]) {
      const got = align(spans(sub), spans(ref, minutes * 60_000))
      assert.notEqual(got.status, 'unsure', `${sub} with ${minutes} minutes`)
      assert.equal(checkPattern(got), 'ok', `${sub} with ${minutes} minutes`)
    }
  }
})

test('real subtitles: the next episode is never moved into place, and is called wrong once enough is read', () => {
  for (const [sub, ref] of [['spy2-official', 'spy1-official'], ['spy2-official', 'spy1-fan-a'], ['csm2-official', 'csm1-official'], ['csm1-official', 'csm2-official']] as const) {
    const early = align(spans(sub), spans(ref, 5 * 60_000))
    assert.notEqual(early.status, 'synced', `${sub} on ${ref}, 5 minutes`)
    assert.deepEqual(early.shifts, [])

    const full = align(spans(sub), spans(ref))
    assert.notEqual(full.status, 'synced', `${sub} on ${ref}`)
    assert.equal(checkPattern(full), 'wrong', `${sub} on ${ref}`)
  }
})

test('real subtitles: a late copy is moved back, in two parts where it was late by two amounts', () => {
  const late = spans('spy1-fan-a').map(s => ({ start: s.start + (s.start < 600_000 ? 4300 : 9800), end: s.end + (s.start < 600_000 ? 4300 : 9800) }))
  const got = align(late, spans('spy1-official'))
  assert.equal(got.status, 'synced')
  assert.equal(got.shifts.length, 2)
  assert.ok(Math.abs(got.shifts[0]!.offset + 4300) <= 80, String(got.shifts[0]!.offset))
  assert.ok(Math.abs(got.shifts[1]!.offset + 9800) <= 80, String(got.shifts[1]!.offset))
  // with only the first minutes read there is one delay, and nothing wild after the part that was read
  const early = align(late, spans('spy1-official', 5 * 60_000))
  assert.equal(early.status, 'synced')
  assert.equal(early.shifts.length, 1)
})
