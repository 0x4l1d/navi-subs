import { createEngine, maxFiles } from './engine.ts'
import { fontSource, withFont } from './fonts.ts'
import { ORIGIN } from './http.ts'
import { testMirai } from './sources/mirai.ts'
import { defaultStore } from './store.ts'
import { toLink } from './subtitle.ts'

import type { FontSource } from './fonts.ts'
import type { Store } from './store.ts'
import type { Options, SubtitleQuery, SubtitleResult } from './types.ts'

// hayase drops a call after 10s, so the answer leaves before that with what there is
const LIMIT = 9300

// the engine as a hayase subtitle extension: links and track names, best match first
export function createExtension (budget = 8000, grace = 1500, link = toLink, fonts: FontSource = fontSource(), store: Store = defaultStore()) {
  const engine = createEngine({ budget, grace, store })

  return {
    url: ORIGIN,
    engine,
    test: testMirai,

    async single (query: SubtitleQuery, options: Options = {}): Promise<SubtitleResult[]> {
      const started = Date.now()
      const { results } = await engine.find(query, options)
      const picked = results.slice(0, maxFiles(options))

      // the font comes only when it is wanted and there is something to give it to. a slow google
      // must not cost the answer, so it gets the time that is left and no more
      const wait = Math.max(0, Math.min(budget, LIMIT) - (Date.now() - started))
      const loaded = picked.length && options.fonts !== false
        ? await Promise.race([fonts(query.fetch), new Promise<undefined>(resolve => setTimeout(resolve, Math.max(wait, 300)))])
        : undefined

      return picked.map(found => {
        const shown = loaded ? withFont(found.text, found.format, loaded) : found
        // an srt that became an ass is called one
        return { url: link(shown.text, shown.format), language: found.label.replace(/\.\w+$/, `.${shown.format}`) }
      })
    }
  }
}
