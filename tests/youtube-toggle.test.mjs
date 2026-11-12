import assert from 'node:assert/strict'
import test from 'node:test'

const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)) }
}
globalThis.window = new EventTarget()

const { importTypeScript } = await import('./load-typescript.mjs')
const { YOUTUBE_BUILTIN, readPlugins, readEnabled, savePlugins, saveEnabled, resolveSearchOptions, youtubeSearchEnabled, ensureBuiltinDefaults } =
  await importTypeScript('../src/renderer/src/plugin-sdk.ts')

test('activating the built-in source persists the manifest and enables it', () => {
  assert.equal(youtubeSearchEnabled(readPlugins(), readEnabled()), false)

  savePlugins([...readPlugins(), YOUTUBE_BUILTIN])
  saveEnabled([...new Set([...readEnabled(), YOUTUBE_BUILTIN.id])])

  const plugins = readPlugins()
  const enabled = readEnabled()
  assert.equal(youtubeSearchEnabled(plugins, enabled), true)
  assert.equal(youtubeSearchEnabled(plugins, []), false)
  assert.deepEqual(resolveSearchOptions(plugins, enabled), { archiveOpenOnly: true, youtube: true })

  saveEnabled(enabled.filter((id) => id !== YOUTUBE_BUILTIN.id))
  assert.equal(youtubeSearchEnabled(readPlugins(), readEnabled()), false)
  const options = resolveSearchOptions(readPlugins(), readEnabled())
  assert.equal(options.youtube, undefined)
})

test('first run enables the built-in source and a later disable is respected', () => {
  store.clear()
  ensureBuiltinDefaults()
  assert.equal(youtubeSearchEnabled(readPlugins(), readEnabled()), true)

  saveEnabled(readEnabled().filter((id) => id !== YOUTUBE_BUILTIN.id))
  ensureBuiltinDefaults()
  assert.equal(youtubeSearchEnabled(readPlugins(), readEnabled()), false)
})
