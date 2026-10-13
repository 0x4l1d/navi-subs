import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createEngine } from '../src/engine.ts'
import { label, nameOf } from '../src/label.ts'
import { describe } from '../src/names.ts'
import { fingerprint } from '../src/rank.ts'
import { fullName, parseRelease } from '../src/release.ts'
import { memoryStore } from '../src/store.ts'

import { badge, block, page, UPLOADS } from './helpers/pages.ts'
import { fakeSite } from './helpers/server.ts'
import { buildZip } from './helpers/zipbuilder.ts'

import type { Options, SubtitleQuery } from '../src/types.ts'

const ORIGIN = 'https://miraianime.net'
const SUBDL = 'https://api.subdl.com/api/v1/subtitles'
const SUBSOURCE = 'https://api.subsource.net/api/v1'
// stands in for a personal key, it opens nothing
const KEY = 'not-a-real-key'

const ass = (line: string, start = '0:00:01.00') => `[Script Info]\r\nTitle: test\r\n\r\n[Events]\r\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\r\nDialogue: 0,${start},0:00:02.00,Default,,0,0,0,,${line}\r\n`
const malPage = (mal: number, slug: string) => [`${ORIGIN}/anime/?my_anime_list_ID=${mal}&submit=`, `<div><a href="${ORIGIN}/anime/${slug}/">title</a></div>`] as const

function naruto () {
  return {
    ...Object.fromEntries([malPage(1735, 'naruto-shippuuden')]),
    [`${ORIGIN}/subtitle/naruto-shippuuden/`]: page(
      block({ episodes: `${badge('001')} إلى ${badge('004')}`, release: 'BD/WEB/DVD', translators: ['Cr', 'Almighty'], links: [`${UPLOADS}/Naruto-BD.zip`] }),
      block({ episodes: badge('01'), release: 'TV', translators: ['Old Sub'], links: [`${UPLOADS}/Naruto-TV-01.zip`] }),
      block({ episodes: badge('01'), release: 'WEB', translators: ['Cr'], links: [`${UPLOADS}/Naruto-WEB-01.zip`] }),
      block({ episodes: badge('02'), release: 'WEB', translators: ['Cr'], links: [`${UPLOADS}/Naruto-WEB-02.zip`] })
    ),
    [`${UPLOADS}/Naruto-BD.zip`]: buildZip([1, 2, 3, 4].map(n => ({ name: `Naruto Shippuden - 00${n} [BD (US) 1080p][DBD-Raws][Crunchyroll & Almighty].ass`, data: ass(`bd ${n}`) }))),
    [`${UPLOADS}/Naruto-TV-01.zip`]: buildZip([{ name: '[Old Sub] Naruto Shippuuden - 01 [TV].ass', data: ass('tv 1') }]),
    [`${UPLOADS}/Naruto-WEB-01.zip`]: buildZip([{ name: '[Crunchyroll] Naruto Shippuuden - 01.ass', data: ass('web 1') }]),
    [`${UPLOADS}/Naruto-WEB-02.zip`]: buildZip([{ name: '[Crunchyroll] Naruto Shippuuden - 02.ass', data: ass('web 2') }])
  }
}

type Routes = Parameters<typeof fakeSite>[0]
const urls = (site: { hits: Array<{ url: string }> }) => site.hits.map(h => h.url)

function setup (routes: Routes = naruto(), engineOptions: Parameters<typeof createEngine>[0] = {}) {
  const site = fakeSite(routes)
  const headers: Array<Record<string, string>> = []
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    headers.push(Object.fromEntries(new Headers(init?.headers).entries()))
    return await site.fetch(input, init)
  }) as typeof fetch
  const store = engineOptions.store ?? memoryStore()
  const engine = createEngine({ store, ...engineOptions })
  const q = (extra: Partial<SubtitleQuery> = {}): SubtitleQuery => ({ anilistId: 1735, malId: 1735, episode: 1, episodeCount: 500, titles: ['Naruto: Shippuuden', 'Naruto Shippuden'], fetch: fetchFn, ...extra })
  const find = async (extra: Partial<SubtitleQuery> = {}, options: Options = {}) => (await engine.find(q(extra), { ahead: false, ...options })).results
  return { site, engine, q, find, store, headers }
}

test('brackets inside brackets: the label names the source in full and the release it was timed for', () => {
  const file = describe('Naruto Shippuden - 001 [BD (US) 1080p][DBD-Raws][Crunchyroll & Almighty].ass')!
  assert.deepEqual([file.group, file.video, file.medium, file.episodes], ['Crunchyroll & Almighty', 'DBD-Raws', 'BD', [1, 1]])
  const named = nameOf({ ...file, mixed: false }, { translators: ['Cr', 'Almighty'], release: 'BD/WEB/DVD' }, 'Mirai')
  assert.equal(label(named, 'ass'), 'Arabic - Crunchyroll & Almighty (BD · DBD-Raws).ass')
})

test('odd bracket shapes do not lose the name or the episode', () => {
  assert.deepEqual(describe('[Group (Team A)] Show - 05 [1080p (HEVC)].ass')?.episodes, [5, 5])
  assert.equal(describe('[Group (Team A)] Show - 05 [1080p (HEVC)].ass')?.group, 'Group (Team A)')
  // a bracket that never closes is part of the name
  assert.deepEqual(describe('Show (2024 - 07.ass')?.episodes, [7, 7])
  assert.equal(describe('Show - 03 [BD 1080p (Dual Audio)].srt')?.group, undefined)
  assert.equal(describe('【Fansub】Show - 12 [WEB].ass')?.medium, 'WEB')
})

test('short source names are written out', () => {
  assert.equal(fullName('Cr'), 'Crunchyroll')
  assert.equal(fullName('Nf'), 'Netflix')
  assert.equal(fullName('Cr & Nf'), 'Crunchyroll & Netflix')
  assert.equal(fullName('AMZN'), 'Amazon')
  // a name that only starts like one is left alone
  assert.equal(fullName('Crow Subs'), 'Crow Subs')
  assert.equal(label({ who: fullName('Cr'), medium: 'WEB' }, 'ass'), 'Arabic - Crunchyroll (WEB).ass')
})

test('a video file name is read for its release', () => {
  assert.deepEqual(parseRelease('[DBD-Raws][Naruto Shippuden][001][1080P][BDRip][HEVC-10bit][FLAC].mkv'), { medium: 'BD', group: 'DBD-Raws', resolution: 1080 })
  assert.deepEqual(parseRelease('[SubsPlease] Sousou no Frieren - 05 (1080p) [ABCD1234].mkv'), { medium: undefined, group: 'SubsPlease', resolution: 1080 })
  assert.deepEqual(parseRelease('Jujutsu.Kaisen.S02E05.1080p.CR.WEB-DL.AAC2.0.H.264-VARYG.mkv'), { medium: 'WEB', group: 'VARYG', resolution: 1080 })
})

test('with nothing to go on the web release leads, with the video known its own release leads', async () => {
  const { find } = setup()
  const plain = await find()
  assert.deepEqual(plain.map(r => r.label), ['Arabic - Crunchyroll (WEB).ass', 'Arabic - Crunchyroll & Almighty (BD · DBD-Raws).ass', 'Arabic - Old Sub (TV).ass'])

  const bd = await find({ fileName: '[DBD-Raws][Naruto Shippuden][001][1080P][BDRip][HEVC-10bit].mkv' })
  assert.equal(bd[0]!.label, 'Arabic - Crunchyroll & Almighty (BD · DBD-Raws).ass')

  const tv = await find({ fileName: '[Leopard-Raws] Naruto Shippuuden - 01 (TX 1280x720 x264 AAC).mkv' }, { release: 'TV' })
  assert.equal(tv[0]!.label, 'Arabic - Old Sub (TV).ass')
})

test('the preferred release setting moves that release up when the video says nothing', async () => {
  const { find } = setup()
  assert.equal((await find({}, { release: 'BD' }))[0]!.medium, 'BD')
  assert.equal((await find({}, { release: 'TV' }))[0]!.medium, 'TV')
  assert.equal((await find({}, { release: 'Any' }))[0]!.medium, 'WEB')
})

test('after a restart the saved lookups and files answer without the site', async () => {
  const first = setup()
  assert.equal((await first.find()).length, 3)
  assert.ok(first.site.hits.length >= 4)

  // a new engine is a new start: empty memory, the same store
  const second = setup(naruto(), { store: first.store })
  assert.equal((await second.find()).length, 3)
  assert.deepEqual(second.site.hits, [])

  // another episode still skips the lookup and the listing, only its zip is fetched
  await second.find({ episode: 2 })
  const asked = urls(second.site)
  assert.ok(asked.length > 0)
  assert.ok(asked.every(url => url.endsWith('.zip')), asked.join(' '))
})

test('a saved listing that knows nothing of a new episode is fetched again', async () => {
  const routes = naruto()
  const { find, store, site } = setup(routes)
  await find()
  // the listing is a quarter of an hour old and episode 5 was uploaded since
  const kept = await store.get<unknown>('mirai:list:naruto-shippuuden')
  const realNow = Date.now
  Date.now = () => realNow() + 15 * 60 * 1000
  try {
    const later = setup({ ...routes, [`${ORIGIN}/subtitle/naruto-shippuuden/`]: page(block({ episodes: badge('05'), release: 'WEB', translators: ['Cr'], links: [`${UPLOADS}/Naruto-WEB-05.zip`] })), [`${UPLOADS}/Naruto-WEB-05.zip`]: buildZip([{ name: '[Crunchyroll] Naruto - 05.ass', data: ass('web 5') }]) }, { store })
    assert.ok(kept)
    assert.equal((await later.find({ episode: 5 })).length, 1)
    assert.ok(later.site.hits.some(h => h.url.endsWith('/subtitle/naruto-shippuuden/')))
  } finally {
    Date.now = realNow
  }
  assert.ok(site.hits.length > 0)
})

test('the next episode is read ahead, so opening it costs nothing', async () => {
  const { engine, q, site } = setup()
  const { done } = await engine.find(q(), {})
  await done
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.ok(site.hits.some(h => h.url.endsWith('Naruto-WEB-02.zip')), 'episode 2 was fetched ahead')

  site.hits.length = 0
  const next = await engine.find(q({ episode: 2 }), {})
  assert.ok(next.results.length >= 1)
  assert.deepEqual(site.hits.filter(h => !h.url.includes('WEB-03')), [])
})

test('without keys only mirai is asked', async () => {
  const { find, site, engine } = setup()
  await find()
  assert.ok(site.hits.every(h => h.url.startsWith(ORIGIN)))
  assert.deepEqual(engine.ready({}), ['mirai'])
  assert.deepEqual(engine.ready({ subdlKey: KEY, subsourceKey: KEY }), ['mirai', 'subdl', 'subsource'])
  assert.deepEqual(engine.ready({ subdlKey: KEY, subdl: false, mirai: false }), [])
})

// answers shaped like the two apis give them, with invented values
function others () {
  const subdlList = `${SUBDL}?api_key=${KEY}&imdb_id=tt0988824&type=tv&season_number=1&episode_number=1&languages=AR&subs_per_page=30`
  return {
    ...naruto(),
    [subdlList]: JSON.stringify({
      status: true,
      results: [{ sd_id: 1, type: 'tv', name: 'Naruto Shippuden', imdb_id: 'tt0988824' }],
      subtitles: [
        { release_name: 'Naruto.Shippuden.S01E01.1080p.BluRay.x264-KAWAII', name: 'SUBDL::one', lang: 'arabic', author: 'Uploader One', url: '/subtitle/100-200.zip', season: 1, episode: 1 },
        { release_name: 'Naruto Shippuden S02E01 WEB', name: 'SUBDL::other season', lang: 'arabic', author: 'Somebody', url: '/subtitle/100-201.zip', season: 2, episode: 1 },
        { release_name: '[Crunchyroll] Naruto Shippuuden - 01', name: 'SUBDL::same script', lang: 'arabic', author: 'Mirror', url: '/subtitle/100-202.zip', season: 1, episode: 1 }
      ]
    }),
    'https://dl.subdl.com/subtitle/100-200.zip': buildZip([{ name: 'Naruto.Shippuden.S01E01.1080p.BluRay.x264-KAWAII.srt', data: '1\r\n00:00:01,000 --> 00:00:02,000\r\nsubdl line\r\n' }]),
    'https://dl.subdl.com/subtitle/100-201.zip': buildZip([{ name: 'Naruto Shippuden S02E01.srt', data: '1\r\n00:00:01,000 --> 00:00:02,000\r\nwrong season\r\n' }]),
    // the same script mirai has, timed differently
    'https://dl.subdl.com/subtitle/100-202.zip': buildZip([{ name: '[Crunchyroll] Naruto Shippuuden - 01.ass', data: ass('web 1', '0:00:03.00') }]),

    [`${SUBSOURCE}/movies/search?searchType=imdb&imdb=tt0988824&type=series&season=1`]: JSON.stringify({ success: true, data: [{ movieId: 777, title: 'Naruto Shippuden', type: 'tvseries', season: 1, imdbId: 'tt0988824', subtitleCount: 3 }, { movieId: 778, title: 'Naruto Shippuden', type: 'tvseries', season: 2 }] }),
    [`${SUBSOURCE}/subtitles?movieId=777&language=arabic&limit=100&sort=popular`]: JSON.stringify({
      success: true,
      data: [
        { subtitleId: 5001, language: 'arabic', releaseInfo: ['Naruto.Shippuden.E01.720p.HDTV', 'Naruto Shippuden - 001 [TV]'], releaseType: 'hdtv', files: 1, contributors: [{ id: 1, displayname: 'Translator Two' }] },
        { subtitleId: 5002, language: 'arabic', releaseInfo: ['Naruto Shippuden - 007'], files: 1 }
      ],
      pagination: { page: 1, limit: 100, total: 2, pages: 1 }
    }),
    [`${SUBSOURCE}/subtitles/5001/download`]: buildZip([{ name: 'Naruto.Shippuden.E01.720p.HDTV.srt', data: '1\r\n00:00:01,000 --> 00:00:02,000\r\nsubsource line\r\n' }])
  }
}

const keys = { subdlKey: KEY, subsourceKey: KEY }
const imdb = { imdbId: 'tt0988824' }

test('with keys all three are asked, merged, and the same script from two places shows once', async () => {
  const { find, site, headers } = setup(others())
  const results = await find(imdb, keys)

  assert.deepEqual(results.map(r => r.source).sort(), ['mirai', 'mirai', 'mirai', 'subdl', 'subsource'])
  assert.equal(results.filter(r => r.text.includes('web 1')).length, 1, 'the crunchyroll script is there once')
  assert.equal(results.find(r => r.text.includes('web 1'))!.source, 'mirai')
  assert.ok(!results.some(r => r.text.includes('wrong season')), 'a season 2 file is left out')
  assert.ok(!site.hits.some(h => h.url.includes('5002')), 'episode 7 is never downloaded')

  const subdl = results.find(r => r.source === 'subdl')!
  assert.equal(subdl.label, 'Arabic - Uploader One (BD · KAWAII).srt')
  assert.equal(subdl.sourceName, 'SubDL')
  const subsource = results.find(r => r.source === 'subsource')!
  assert.equal(subsource.label, 'Arabic - Translator Two (TV).srt')

  // the subsource key travels in a header, and only to subsource
  const sent = site.hits.map((h, i) => ({ url: h.url, key: headers[i]!['x-api-key'] }))
  assert.ok(sent.filter(s => s.url.startsWith(SUBSOURCE)).every(s => s.key === KEY))
  assert.ok(sent.filter(s => !s.url.startsWith(SUBSOURCE)).every(s => s.key === undefined))
  assert.ok(site.hits.filter(h => h.url.includes(KEY)).every(h => h.url.startsWith(SUBDL)), 'the subdl key only goes to subdl')
})

test('searches are saved, so opening the episode again spends none of the daily allowance', async () => {
  const first = setup(others())
  await first.find(imdb, keys)
  const api = (hits: Array<{ url: string }>) => hits.filter(h => h.url.startsWith(SUBDL) || h.url.startsWith(SUBSOURCE))
  assert.equal(api(first.site.hits).length, 4, 'one subdl search, one subsource lookup, one list, one download')
  assert.equal((await first.store.get<number>(`quota:subdl:${new Date().toISOString().slice(0, 10)}`))?.value, 1)

  const second = setup(others(), { store: first.store })
  const again = await second.find(imdb, keys)
  assert.equal(again.length, 5)
  assert.deepEqual(second.site.hits, [])
})

test('a source that is down, or refuses the key, does not take the others with it', async () => {
  const routes = others()
  const broken = Object.fromEntries(Object.entries(routes).map(([url, body]) => [url, url.startsWith(SUBDL) ? { status: 500 } : url.startsWith(SUBSOURCE) ? { status: 401 } : body])) as Routes
  const { find } = setup(broken)
  const results = await find(imdb, keys)
  assert.deepEqual(results.map(r => r.source), ['mirai', 'mirai', 'mirai'])
})

test('an optional source that fails never raises an error, its trouble is kept for its settings', async () => {
  const down = Object.fromEntries(Object.entries(others()).filter(([url]) => !url.startsWith(ORIGIN)).map(([url, body]) => [url, url.startsWith(SUBDL) ? { status: 500 } : body])) as Routes
  const one = setup(down)
  // mirai is off and subdl is broken: still no error, just nothing
  assert.deepEqual((await one.engine.find(one.q(imdb), { subdlKey: KEY, mirai: false, ahead: false })).results, [])
  assert.deepEqual([one.engine.status('subdl')?.ok, one.engine.status('subdl')?.problem], [false, 'other'])

  const refused = Object.fromEntries(Object.entries(others()).map(([url, body]) => [url, url.startsWith(SUBDL) ? { status: 403 } : body])) as Routes
  const two = setup(refused)
  assert.equal((await two.engine.find(two.q(imdb), { subdlKey: KEY, ahead: false })).results.length, 3)
  assert.equal(two.engine.status('subdl')?.problem, 'key')
  assert.equal(two.engine.status('mirai')?.ok, true)
})

test('subdl downloads blocked by cloudflare: quiet, said in its status, everything else works', async () => {
  const blocked = Object.fromEntries(Object.entries(others()).map(([url, body]) => [url, url.startsWith('https://dl.subdl.com') ? { status: 403, body: '<title>Just a moment...</title>' } : body])) as Routes
  const { engine, q } = setup(blocked)
  const { results } = await engine.find(q(imdb), { ...keys, ahead: false })
  assert.deepEqual(results.map(r => r.source).sort(), ['mirai', 'mirai', 'mirai', 'subsource'])
  assert.deepEqual([engine.status('subdl')?.ok, engine.status('subdl')?.problem], [false, 'blocked'])
  assert.equal(engine.status('subsource')?.ok, true)
})

test('a source with no key is never asked and has no status to show', async () => {
  const { engine, q } = setup(others())
  await engine.find(q(imdb), { ahead: false })
  assert.equal(engine.status('subdl'), undefined)
  assert.equal(engine.status('subsource'), undefined)
})

test('a source switched off is not asked even with a key', async () => {
  const { find, site } = setup(others())
  const results = await find(imdb, { ...keys, subdl: false, subsource: false })
  assert.deepEqual(results.map(r => r.source), ['mirai', 'mirai', 'mirai'])
  assert.ok(site.hits.every(h => h.url.startsWith(ORIGIN)))
})

test('the fingerprint ignores timing and styling, not words', () => {
  assert.equal(fingerprint(ass('hello there', '0:00:01.00')), fingerprint(ass('{\\an8}hello there', '0:05:00.00')))
  assert.notEqual(fingerprint(ass('hello there')), fingerprint(ass('hello here')))
  assert.equal(fingerprint('1\r\n00:00:01,000 --> 00:00:02,000\r\nline\r\n'), fingerprint('1\n00:00:09,000 --> 00:00:10,000\nline\n'))
})
