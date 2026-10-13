import assert from 'node:assert/strict'
import { test } from 'node:test'

import { judge, judgeFiles, parseName } from '../src/season.ts'

import type { Related, Wanted } from '../src/season.ts'

const rel = (relation: string, titles: string[], episodes?: number, format = 'TV'): Related => ({ relation, titles, episodes, format })
const want = (titles: string[], episodes: number, related: Related[], episode = 1, absolute?: number, format = 'TV'): Wanted => ({ entry: { titles, episodes, format }, related, episode, absolute })

// anilist's names for each entry, and its neighbours
const spy1 = want(['SPY×FAMILY', 'SPY x FAMILY', 'SxF'], 12, [rel('SEQUEL', ['SPY×FAMILY Part 2', 'SPY x FAMILY Part 2', 'SPY×FAMILY Cour 2'], 13)])
const spy2 = want(['SPY×FAMILY Part 2', 'SPY x FAMILY Part 2'], 13, [rel('PREQUEL', ['SPY×FAMILY', 'SPY x FAMILY'], 12), rel('SEQUEL', ['SPY×FAMILY Season 2', 'SPY x FAMILY Season 2'], 12)], 1, 13)
const jjk1 = want(['Jujutsu Kaisen', 'JUJUTSU KAISEN', 'Sorcery Fight', 'JJK'], 24, [rel('PREQUEL', ['Jujutsu Kaisen 0'], 1, 'MOVIE'), rel('SEQUEL', ['Jujutsu Kaisen 2nd Season', 'JUJUTSU KAISEN Season 2', 'JJK 2'], 23)])
const jjk2 = want(['Jujutsu Kaisen 2nd Season', 'JUJUTSU KAISEN Season 2'], 23, [rel('PREQUEL', ['Jujutsu Kaisen', 'JUJUTSU KAISEN'], 24), rel('SEQUEL', ['Jujutsu Kaisen: Shimetsu Kaiyuu', 'JUJUTSU KAISEN Season 3'], 12)], 1, 25)
const aot1 = want(['Shingeki no Kyojin: The Final Season', 'Attack on Titan Final Season', 'Shingeki no Kyojin Season 4', 'SnK 4'], 16, [rel('PREQUEL', ['Shingeki no Kyojin Season 3 Part 2', 'Attack on Titan Season 3 Part 2'], 10), rel('SEQUEL', ['Shingeki no Kyojin: The Final Season Part 2', 'Attack on Titan Final Season Part 2'], 12)])
const aot2 = want(['Shingeki no Kyojin: The Final Season Part 2', 'Attack on Titan Final Season Part 2'], 12, [rel('PREQUEL', ['Shingeki no Kyojin: The Final Season', 'Attack on Titan Final Season'], 16), rel('SEQUEL', ['Shingeki no Kyojin: The Final Season - Kanketsu-hen', 'Attack on Titan Final Season THE FINAL CHAPTERS Special 1'], 1, 'SPECIAL')], 1, 17)
const kny1 = want(['Kimetsu no Yaiba', 'Demon Slayer: Kimetsu no Yaiba'], 26, [rel('SEQUEL', ['Kimetsu no Yaiba: Mugen Ressha-hen', 'Demon Slayer -Kimetsu no Yaiba- The Movie: Mugen Train'], 1, 'MOVIE'), rel('SEQUEL', ['Kimetsu no Yaiba: Mugen Ressha-hen (TV)', 'Demon Slayer: Kimetsu no Yaiba Mugen Train Arc'], 7)])
const bleach1 = want(['BLEACH: Sennen Kessen-hen', 'BLEACH: Thousand-Year Blood War', 'Bleach TYBW'], 13, [rel('PREQUEL', ['BLEACH', 'Bleach'], 366), rel('SEQUEL', ['BLEACH: Sennen Kessen-hen - Ketsubetsu-tan', 'BLEACH: Thousand-Year Blood War - The Separation', 'Bleach: Thousand-Year Blood War Part 2'], 13)])
const mushoku21 = want(['Mushoku Tensei II: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation Season 2'], 13, [rel('PREQUEL', ['Mushoku Tensei: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Part 2'], 12), rel('SEQUEL', ['Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2'], 12)])
const mushoku22 = want(['Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2', 'Mushoku Tensei: Jobless Reincarnation Season 2 Part 2'], 12, [rel('PREQUEL', ['Mushoku Tensei II: Isekai Ittara Honki Dasu', 'Mushoku Tensei: Jobless Reincarnation Season 2'], 13)], 1, 14)

const verdict = (name: string, wanted: Wanted) => judge(name, wanted).verdict

test('names are read: season, part, episode, batch', () => {
  const erai = parseName('[Erai-raws] Spy x Family Part 2 - 01 [1080p][Multiple Subtitle][ABCD1234].mkv')
  assert.deepEqual([erai.title, erai.base, erai.part, erai.episodes], ['Spy x Family Part 2', 'Spy x Family', 2, [1, 1]])

  const scene = parseName('Jujutsu.Kaisen.S02E05.1080p.CR.WEB-DL.AAC2.0.H.264-VARYG.mkv')
  assert.deepEqual([scene.base, scene.season, scene.episodes], ['Jujutsu Kaisen', 2, [5, 5]])

  const batch = parseName('[Erai-raws] Jujutsu Kaisen 2nd Season - 01 ~ 23 [1080p][BATCH]')
  assert.deepEqual([batch.season, batch.episodes, batch.batch], [2, [1, 23], true])

  assert.equal(parseName('[Judas] Mushoku Tensei II - 03 [1080p]').season, 2)
  assert.equal(parseName('[SubsPlease] Shingeki no Kyojin - The Final Season Part 3 - 01 (1080p)').part, 3)
  assert.deepEqual(parseName('[Group] Show (Season 1-3) [BD 1080p]').seasons, [1, 3])
  // numbers that belong to the name are not seasons
  for (const name of ['[SubsPlease] Kaijuu 8-gou - 01 (1080p)', '[Erai-raws] Mob Psycho 100 - 01', '[SubsPlease] Jujutsu Kaisen 0 (1080p)', '[SubsPlease] 86 - Eighty Six - 05']) {
    assert.equal(parseName(name).season, undefined, name)
    assert.equal(parseName(name).part, undefined, name)
  }
})

test('spy x family part 1 hides part 2 and later seasons, keeps its own', () => {
  assert.equal(verdict('[SubsPlease] Spy x Family - 01 (1080p) [F2A0B5F2].mkv', spy1), 'same')
  assert.equal(verdict('[Erai-raws] Spy x Family - 01 [1080p][Multiple Subtitle]', spy1), 'same')
  assert.equal(verdict('[Erai-raws] Spy x Family Part 2 - 01 ~ 13 (v2) [1080p][BATCH]', spy1), 'other')
  assert.equal(verdict('[Erai-raws] Spy x Family Season 3 - 01 [1080p CR WEB-DL AVC AAC][MultiSub]', spy1), 'other')
  assert.equal(verdict('[Judas] Spy x Family S2 - 01', spy1), 'other')
  assert.equal(verdict('SPY.x.FAMILY.S01E01.1080p.BluRay.x264-GROUP', spy1), 'same')
  assert.equal(verdict('[Anime Time] Spy x Family (Season 1+2) [BD][1080p][Dual Audio]', spy1), 'same')
})

test('spy x family part 2 keeps both ways of numbering and drops part 1', () => {
  assert.equal(verdict('[Erai-raws] Spy x Family Part 2 - 01 [1080p]', spy2), 'same')
  // subsplease counts on from part 1
  assert.equal(verdict('[SubsPlease] Spy x Family - 13 (1080p)', spy2), 'same')
  assert.equal(verdict('[SubsPlease] Spy x Family - 01 (1080p)', spy2), 'other')
  assert.equal(verdict('[Erai-raws] Spy x Family Season 2 - 01 [1080p]', spy2), 'other')
  assert.equal(verdict('[Judas] Spy x Family (Season 1) [BD 1080p][Batch]', spy2), 'same')
})

test('jujutsu kaisen season 1 and 2 stay apart', () => {
  assert.equal(verdict('[SubsPlease] Jujutsu Kaisen - 01 (1080p) [ABCD1234].mkv', jjk1), 'same')
  assert.equal(verdict('[Erai-raws] Jujutsu Kaisen 2nd Season - 01 ~ 23 [1080p][HEVC][BATCH]', jjk1), 'other')
  assert.equal(verdict('[Raze] Jujutsu Kaisen S3 - 01 x265 10bit 1080p', jjk1), 'other')
  assert.equal(verdict('[Feibanyama] JUJUTSU KAISEN S3 - 01-02 [IQIYI WebRip 2160p]', jjk1), 'other')
  assert.equal(verdict('[Judas] Jujutsu Kaisen - S01E01', jjk1), 'same')

  assert.equal(verdict('[Erai-raws] Jujutsu Kaisen 2nd Season - 01 [1080p]', jjk2), 'same')
  assert.equal(verdict('[SubsPlease] Jujutsu Kaisen - 25 (1080p)', jjk2), 'same')
  assert.equal(verdict('[Judas] Jujutsu Kaisen S2 - 01', jjk2), 'same')
  assert.equal(verdict('[SubsPlease] Jujutsu Kaisen - 01 (1080p)', jjk2), 'other')
  assert.equal(verdict('[Raze] Jujutsu Kaisen S3 - 01', jjk2), 'other')
})

test('attack on titan final season parts', () => {
  assert.equal(verdict('[SubsPlease] Shingeki no Kyojin - The Final Season - 01 (1080p)', aot1), 'same')
  assert.equal(verdict('[Erai-raws] Shingeki no Kyojin - The Final Season - 60 [1080p]', aot1), 'same')
  assert.equal(verdict('[SubsPlease] Shingeki no Kyojin - The Final Season Part 2 - 01 (1080p)', aot1), 'other')
  assert.equal(verdict('[ASW] Shingeki no Kyojin - The Final Season Part 3 - 01 [1080p HEVC]', aot1), 'other')
  assert.equal(verdict('Attack on Titan S04E01 1080p WEB x264', aot1), 'same')
  assert.equal(verdict('[Judas] Shingeki no Kyojin Season 3 Part 2 - 01', aot1), 'other')

  assert.equal(verdict('[SubsPlease] Shingeki no Kyojin - The Final Season Part 2 - 01 (1080p)', aot2), 'same')
  assert.equal(verdict('[SubsPlease] Shingeki no Kyojin - The Final Season - 01 (1080p)', aot2), 'other')
  assert.equal(verdict('[Erai-raws] Shingeki no Kyojin - The Final Season - 76 [1080p]', aot2), 'same')
})

test('demon slayer season 1 drops numbered later seasons and keeps arcs it cannot place', () => {
  assert.equal(verdict('[Erai-raws] Kimetsu no Yaiba - 01 [1080p]', kny1), 'same')
  assert.equal(verdict('[Rip Time] Demon Slayer_ Kimetsu no Yaiba S4 - 01 [1080p]', kny1), 'other')
  assert.equal(verdict('[Yugen] Demon Slayer Kimetsu no Yaiba S05 - 01 To Defeat Muzan Kibutsuji [1080p x265]', kny1), 'other')
  assert.equal(verdict('[SubsPlease] Kimetsu no Yaiba - Mugen Ressha-hen - 01 (1080p)', kny1), 'other')
  assert.equal(verdict('Demon.Slayer.Kimetsu.no.Yaiba.S01.1080p.BluRay.x265-GROUP', kny1), 'same')
})

test('bleach and mushoku tensei: parts that go by other names', () => {
  assert.equal(verdict('[SubsPlease] Bleach - Sennen Kessen-hen - 01 (1080p)', bleach1), 'same')
  assert.equal(verdict('[Erai-raws] Bleach - Sennen Kessen-hen - Ketsubetsu-tan - 01 [1080p]', bleach1), 'other')
  assert.equal(verdict('[Judas] Bleach - Thousand-Year Blood War Part 2 - 01', bleach1), 'other')
  assert.equal(verdict('[SubsPlease] Bleach - 366 (480p)', bleach1), 'other')

  assert.equal(verdict('[SubsPlease] Mushoku Tensei S2 - 01 (1080p)', mushoku21), 'same')
  assert.equal(verdict('[Erai-raws] Mushoku Tensei II - Isekai Ittara Honki Dasu - 01 [1080p]', mushoku21), 'same')
  assert.equal(verdict('[Erai-raws] Mushoku Tensei II - Isekai Ittara Honki Dasu Part 2 - 01 [1080p]', mushoku21), 'other')
  assert.equal(verdict('[Erai-raws] Mushoku Tensei - Isekai Ittara Honki Dasu Part 2 - 01 [1080p]', mushoku21), 'other')

  assert.equal(verdict('[Erai-raws] Mushoku Tensei II - Isekai Ittara Honki Dasu Part 2 - 01 [1080p]', mushoku22), 'same')
  assert.equal(verdict('[SubsPlease] Mushoku Tensei S2 - 14 (1080p)', mushoku22), 'same')
})

test('movies, ovas and batches are never hidden by mistake', () => {
  const yourName = want(['Kimi no Na wa.', 'Your Name.'], 1, [], 1, undefined, 'MOVIE')
  assert.equal(verdict('[Judas] Kimi no Na wa. (Your Name.) [BD 2160p 4K UHD][HEVC x265 10bit]', yourName), 'same')
  assert.equal(verdict('Your.Name.2016.1080p.BluRay.x264-GROUP', yourName), 'same')

  const jjk0 = want(['Jujutsu Kaisen 0', 'JUJUTSU KAISEN 0'], 1, [rel('SEQUEL', ['Jujutsu Kaisen', 'JUJUTSU KAISEN'], 24)], 1, undefined, 'MOVIE')
  assert.equal(verdict('[SubsPlease] Jujutsu Kaisen 0 (1080p) [ABCD1234].mkv', jjk0), 'same')
  assert.equal(verdict('[Judas] Jujutsu Kaisen 0 - Movie [BD 1080p]', jjk0), 'same')

  // an ova next to its series
  const ova = want(['Shingeki no Kyojin OVA', 'Attack on Titan OVA'], 3, [rel('PARENT', ['Shingeki no Kyojin', 'Attack on Titan'], 25)], 1, undefined, 'OVA')
  assert.equal(verdict('[Group] Shingeki no Kyojin OVA - 01 [BD 1080p]', ova), 'same')

  // a show with no neighbours takes anything
  const bocchi = want(['Bocchi the Rock!', 'BOCCHI THE ROCK!'], 12, [])
  assert.equal(verdict('[SubsPlease] Bocchi the Rock! - 01 (1080p)', bocchi), 'same')
  assert.equal(verdict('[Judas] Bocchi the Rock! (Season 1) [BD 1080p][HEVC x265 10bit]', bocchi), 'same')
  assert.equal(verdict('Some Other Show S2 - 01', bocchi), 'same')

  // complete packs hold the wanted season
  assert.equal(verdict('[Judas] Jujutsu Kaisen (Seasons 1-2 + Movie) [BD 1080p][Batch]', jjk1), 'same')
  assert.equal(verdict('[EMBER] Jujutsu Kaisen (Season 1) [BDRip] [1080p Dual Audio HEVC 10 bits]', jjk1), 'same')
})

test('names seen in the app: a season next to an episode, packs by range, a second name after a bar', () => {
  assert.equal(parseName('[Erai-raws] Spy x Family Season 3 - 08 [1080p CR WEB-DL AVC AAC][MultiSub][5A918F12]').season, 3)
  assert.equal(parseName('[Erai-raws] Spy x Family Season 3 - 08 [1080p CR WEB-DL AVC AAC][MultiSub][5A918F12]').seasons, undefined)
  assert.deepEqual(parseName('[SubsPlease] Spy x Family (38-50) (1080p) [Batch]').episodes, [38, 50])
  assert.deepEqual(parseName('[EMBER] Spy x Family (2022) (Season 1 | Part 01 [EP: 01-12]) [BDRip] [1080p Dual Audio HEVC 10 bits DDP]').episodes, [1, 12])
  assert.equal(parseName('[EMBER] Spy x Family (2022-2023) (Season 1 + 2 + Movie) [BDRip] [1080p]').episodes, undefined)
  assert.deepEqual(parseName('[EMBER] Spy x Family (2022-2023) (Season 1 + 2 + Movie) [BDRip] [1080p]').seasons, [1, 2])
  assert.deepEqual(parseName('[Group] Show (Season 1-3) [BD 1080p]').seasons, [1, 3])

  assert.equal(verdict('[Erai-raws] Spy x Family Season 3 - 08 [1080p CR WEB-DL AVC AAC][MultiSub][5A918F12]', spy1), 'other')
  assert.equal(verdict('[Erai-raws] Spy x Family Season 3 - 12 [1080p CR WEBRip HEVC AAC][MultiSub][28139C82]', spy1), 'other')
  assert.equal(verdict('[SubsPlease] Spy x Family (38-50) (1080p) [Batch]', spy1), 'other')
  assert.equal(verdict('[SubsPlease] Spy x Family (26-37) (1080p) [Batch]', spy1), 'other')
  assert.equal(verdict('[SubsPlease] Spy x Family (01-25) (1080p) [Batch]', spy1), 'same')
  assert.equal(verdict('[SweetSpot] Spy x Family (01-38) [BD HEVC 1080p AAC]', spy1), 'same')
  assert.equal(verdict('[yolerejiju] Spy x Family Season 2 (S02) (WEBRip 1080p x265 Opus - DDP) [Multi-Audio] | SPY×FAMILY', spy1), 'other')
  assert.equal(verdict('[yolerejiju] Spy x Family Season 3 (S03) (WEB-DL 1080p H.264 DDP) [Multi-Audio] | SPY×FAMILY', spy1), 'other')
  assert.equal(verdict('[yolerejiju] Spy x Family Season 1 (S01) (WEBRip 1080p x265 Opus - DDP) [Multi-Audio] | SPY×FAMILY', spy1), 'same')
  assert.equal(verdict('[Judas] Spy x Family (Season 1 Part 1) [1080p][HEVC x265 10bit][Multi-Subs] (Batch)', spy1), 'same')
  assert.equal(verdict('[EMBER] Spy x Family (2022-2023) (Season 1 + 2 + Movie) [BDRip] [1080p Dual Audio HEVC 10 bits DDP]', spy1), 'same')
  assert.equal(verdict('[EMBER] Spy x Family (2022) (Season 1 | Part 01 [EP: 01-12]) [BDRip] [1080p Dual Audio HEVC 10 bits DDP]', spy1), 'same')
  assert.equal(verdict('[DKB] Spy x Family - (Season 01) [1st Cour][1080p][HEVC x265 10bit][Multi-Subs][batch]', spy1), 'same')
  assert.equal(verdict('[nyadex] Spy x Family - S01 [01-12] (BD 1080p HEVC FLAC-AAC Multi-Audio)', spy1), 'same')
  assert.equal(verdict('[LostYears] SPY x FAMILY (WEB 1080p HEVC AAC E-AC-3) [7A731790] (Dual Audio)', spy1), 'same')
  assert.equal(verdict('[ABdex] SPY.x.FAMILY..1080p.BluRay.Opus2.0.H.265-ABdex (Dual Audio)', spy1), 'same')
  assert.equal(verdict('[GJM-Kaleido] Spy x Family - 01 (WEB 1080p) [80F0824E]', spy1), 'same')
  // a later season that goes by an arc name this entry's neighbours don't list
  assert.equal(verdict('[Erai-raws] Jujutsu Kaisen: Shimetsu Kaiyuu - Zenpen - 01 [1080p CR WEB-DL AVC AAC][MultiSub]', jjk1), 'unsure')
  assert.equal(verdict('[SubsPlease] Spy x Family - Code White - Movie (1080p)', spy1), 'unsure')
  assert.equal(parseName('[ABdex] SPY.x.FAMILY..1080p.BluRay.Opus2.0.H.265-ABdex (Dual Audio)').title, 'SPY x FAMILY')
  assert.equal(parseName('Attack.on.Titan.S04.1080p.BluRay.MULTi.x265.FLAC.2.0-GapMoe').season, 4)
  // another episode of the right season is not hidden, it just never leads
  assert.equal(verdict('[SubsPlease] Spy x Family - 08 (1080p) [ABCD1234]', spy1), 'unsure')
  // part 2 of the season counts on from 13: a pack of 13-25 holds it, one of 26-37 does not
  assert.equal(verdict('[SubsPlease] Spy x Family (13-25) (1080p) [Batch]', spy2), 'same')
  assert.equal(verdict('[SubsPlease] Spy x Family (26-37) (1080p) [Batch]', spy2), 'other')
})

test('the files inside a torrent settle it', () => {
  assert.equal(judgeFiles(['Jujutsu Kaisen S02/Jujutsu Kaisen S02E01.mkv', 'Jujutsu Kaisen S02/Jujutsu Kaisen S02E02.mkv'], jjk1)?.verdict, 'other')
  assert.equal(judgeFiles(['Show/Jujutsu Kaisen S01E01.mkv', 'Show/Jujutsu Kaisen S02E01.mkv'], jjk1)?.verdict, 'same')
  assert.equal(judgeFiles(['Season 2/Jujutsu Kaisen - 01.mkv'], jjk1)?.verdict, 'other')
  // names that say nothing leave the verdict alone
  assert.equal(judgeFiles(['[SubsPlease] Jujutsu Kaisen - 01 (1080p).mkv'], jjk1), undefined)
  assert.equal(judgeFiles(['readme.txt'], jjk1), undefined)
})
