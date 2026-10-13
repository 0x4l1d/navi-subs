import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

interface Entry {
  manifestVersion: number
  name: string
  version: string
  id: string
  type: string
  accuracy: string
  icon: string
  update: string
  code: string
  media: string
  languages: string[]
  url: string
  options: Record<string, { type: string, description: string, default: unknown }>
}

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const manifest = JSON.parse(read('../index.json')) as Entry[]

test('the manifest has what hayase insists on when importing', () => {
  assert.equal(manifest.length, 1)
  const [entry] = manifest
  for (const key of ['name', 'version', 'description', 'id', 'type', 'accuracy', 'icon', 'update', 'code']) assert.ok(key in entry!, key)
  assert.equal(entry!.type, 'subtitle')
  assert.equal(entry!.manifestVersion, 2)
})

test('update, code and icon point at the public repo', () => {
  const [entry] = manifest
  for (const url of [entry!.update, entry!.code]) assert.match(url, /^https:\/\/raw\.githubusercontent\.com\/0x4l1d\/navi-subs\/main\//)
  assert.ok(entry!.update.endsWith('/index.json'))
  assert.ok(entry!.code.endsWith('/dist/navi-subs.js'))
  assert.match(entry!.icon, /^https:\/\/raw\.githubusercontent\.com\/0x4l1d\/navi-subs\/main\/icon\.png$/)
  assert.ok(existsSync(new URL('../icon.png', import.meta.url)))
})

test('the site is told to hayase as a base64 origin, so desktop hayase can switch cors on for it', () => {
  // the pages and the zips send no cors headers, only the ios app (which has no cors) works without this
  assert.equal(atob(manifest[0]!.url), 'https://miraianime.net')
})

test('the version lives in index.json only, so bumping it never needs anything else to follow', () => {
  // hayase updates the extension when this changes. package.json and the built file carry no version of their own
  assert.match(manifest[0]!.version, /^\d+\.\d+\.\d+$/)
  assert.equal('version' in (JSON.parse(read('../package.json')) as object), false)
  assert.doesNotMatch(read('../dist/navi-subs.js').split('\n')[0]!, /\d+\.\d+\.\d+/)
})

test('the built file the manifest points at exists', () => {
  assert.ok(existsSync(new URL('../dist/navi-subs.js', import.meta.url)))
})

test('options are typed like hayase expects', () => {
  for (const option of Object.values(manifest[0]!.options)) {
    assert.ok(['string', 'number', 'boolean', 'select'].includes(option.type))
    assert.ok(option.description.length > 0)
    assert.ok('default' in option)
  }
})

test('a select option lists its values and defaults to one of them, key fields start empty', () => {
  const options = manifest[0]!.options as Record<string, { type: string, default: unknown, values?: unknown[] }>
  for (const option of Object.values(options)) {
    if (option.type === 'select') assert.ok(option.values?.includes(option.default))
  }
  // a key never ships with the extension
  assert.equal(options.subdlKey!.default, '')
  assert.equal(options.subsourceKey!.default, '')
})

test('the description hayase shows is there and short', () => {
  const description = (manifest[0] as unknown as { description: string }).description
  assert.ok(description.length > 20 && description.length < 200)
})
