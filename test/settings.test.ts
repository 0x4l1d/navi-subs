import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { createEngine, languagesOf, maxFiles } from '../src/engine.ts'
import { memoryStore } from '../src/store.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('engine options: arabic unless told otherwise, unknown languages fall back, files are capped', () => {
  assert.deepEqual(languagesOf({}).map(l => l.code), ['ar'])
  assert.deepEqual(languagesOf({ languages: 'en' }).map(l => l.code), ['en'])
  assert.deepEqual(languagesOf({ languages: 'ar, en' }).map(l => l.code), ['ar', 'en'])
  assert.deepEqual(languagesOf({ languages: 'xx' }).map(l => l.code), ['ar'])
  assert.equal(maxFiles({}), 3)
  assert.equal(maxFiles({ maxFiles: 99 }), 8)
  assert.equal(maxFiles({ maxFiles: 0 }), 3)
})

test('a keyed source needs its key, an empty or blank one counts as none', () => {
  const engine = createEngine({ store: memoryStore() })
  assert.deepEqual(engine.ready({ subdlKey: '', subsourceKey: '   ' }), ['mirai'])
  assert.deepEqual(engine.ready({ subdlKey: 'x' }), ['mirai', 'subdl'])
  // mirai only has arabic
  assert.deepEqual(engine.ready({ languages: 'en' }), [])
  assert.deepEqual(engine.ready({ languages: 'en', subdlKey: 'x' }), ['subdl'])
})

test('no key, token or personal path is written into the engine or its built file', () => {
  const built = read('../dist/navi-subs.js')
  assert.doesNotMatch(built, /api_key=[A-Za-z0-9]{8,}/)
  assert.doesNotMatch(built, /X-API-Key['"]?\s*:\s*['"][A-Za-z0-9]{8,}/)
  assert.doesNotMatch(built, /[A-Za-z]:\\Users\\|\/home\/[a-z]/)
})
