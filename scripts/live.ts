// live check against the real sites, it is not part of ci
// npm run live            all the shows below, first cold, then again as after a restart
// npm run live -- 154587 5   one anilist id and episode
// keys are read from the environment (SUBDL_KEY, SUBSOURCE_KEY) and never printed
import { createEngine } from '../src/engine.ts'
import { memoryStore } from '../src/store.ts'

import type { MediaLike, SubtitleQuery } from '../src/types.ts'

const SHOWS: Array<[string, number, number]> = [
  ['Frieren', 154587, 5],
  ['One Piece', 21, 1000],
  ['Jujutsu Kaisen S2', 145064, 1],
  ['Attack on Titan Final Season', 110277, 1],
  ['Demon Slayer S1', 101922, 19],
  ['Spy x Family', 140960, 1],
  ['Solo Leveling', 151807, 1],
  ['Chainsaw Man', 127230, 1],
  ['Your Name', 21519, 1],
  ['Naruto Shippuden', 1735, 1],
  ['Dandadan', 171018, 1],
  ['Mob Psycho 100 III', 140439, 1],
  ['Bocchi the Rock', 130003, 1],
  ['Gintama', 918, 64],
  ['Kaiju No. 8', 153288, 1],
  ['Blue Lock S2', 163146, 1]
]

const GQL = `query($id:Int){Media(id:$id){id idMal episodes format title{romaji english native} synonyms
 relations{edges{relationType node{format episodes title{romaji english native} synonyms}}}}}`

async function media (id: number): Promise<MediaLike & { id: number }> {
  const res = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: GQL, variables: { id } }) })
  return (await res.json() as { data: { Media: MediaLike & { id: number } } }).data.Media
}

const options = { subdlKey: process.env.SUBDL_KEY, subsourceKey: process.env.SUBSOURCE_KEY, ahead: false }
const [onlyId, onlyEpisode] = process.argv.slice(2).map(Number)
const shows = onlyId ? [[`anilist ${onlyId}`, onlyId, onlyEpisode || 1] as [string, number, number]] : SHOWS

// one store for both rounds, like the disk cache that survives a restart
const store = memoryStore(2000)
const queries = new Map<number, SubtitleQuery>()

async function round (title: string) {
  // a new engine has an empty memory, only the store is left
  const engine = createEngine({ store })
  console.log(`\n${title}`)
  let found = 0
  let slowest = 0
  for (const [name, id, episode] of shows) {
    let query = queries.get(id)
    if (!query) {
      const m = await media(id)
      query = {
        anilistId: id,
        malId: m.idMal,
        episode,
        episodeCount: m.episodes ?? undefined,
        titles: [m.title?.romaji, m.title?.english, ...(m.synonyms ?? [])].filter((t): t is string => !!t && t.length > 3),
        media: m,
        fetch
      }
      queries.set(id, query)
    }
    const started = Date.now()
    try {
      const { results, pending } = await engine.find(query, options)
      const ms = Date.now() - started
      slowest = Math.max(slowest, ms)
      if (results.length) found++
      console.log(`${results.length ? 'ok  ' : 'NONE'} ${String(ms).padStart(5)} ms  ${name} ep ${episode}: ${results.length} file(s)${pending ? ' (still working)' : ''}${results[0] ? `  first: ${results[0].label}` : ''}`)
    } catch (error) {
      console.log(`FAIL ${String(Date.now() - started).padStart(5)} ms  ${name} ep ${episode}: ${(error as Error).message}`)
    }
  }
  console.log(`${found}/${shows.length} found, slowest ${slowest} ms`)
}

await round('cold (nothing remembered)')
await round('after a restart (only the saved lookups and files are left)')
