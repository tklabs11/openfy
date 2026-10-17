import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { validateManifest, resolveSearchOptions } = await importTypeScript('../src/renderer/src/plugin-sdk.ts')
const { buildArchiveQuery } = await importTypeScript('../src/main/sources/archive-query.ts')

const wide = {
  schemaVersion: 1,
  id: 'pessoal.busca-ampla',
  name: 'Busca ampla',
  version: '1.0.0',
  author: 'Eu',
  description: 'Tira o filtro de licença do Internet Archive.',
  kind: 'integration',
  permissions: ['search.configure'],
  effects: [{ type: 'search.archive-license-filter', value: 'off' }]
}

test('accepts a manifest with a supported effect and its permission', () => {
  const m = validateManifest(wide)
  assert.deepEqual(m.effects, [{ type: 'search.archive-license-filter', value: 'off' }])
})

test('rejects an effect without the matching permission', () => {
  assert.throws(() => validateManifest({ ...wide, permissions: [] }), /exige a permissão search\.configure/)
})

test('rejects unknown effect types, invalid values and duplicates', () => {
  assert.throws(() => validateManifest({ ...wide, effects: [{ type: 'run.code', value: 'x' }] }), /não suportado/)
  assert.throws(() => validateManifest({ ...wide, effects: [{ type: 'search.archive-license-filter', value: 'maybe' }] }), /Valor inválido/)
  const e = wide.effects[0]
  assert.throws(() => validateManifest({ ...wide, effects: [e, e] }), /duplicado/)
})

test('manifests without effects keep working', () => {
  const m = validateManifest({ ...wide, permissions: [], effects: undefined })
  assert.equal(m.effects, undefined)
})

test('default is the restrictive filter; only an ENABLED plugin relaxes it', () => {
  const plugin = validateManifest(wide)
  assert.deepEqual(resolveSearchOptions([], []), { archiveOpenOnly: true })
  assert.deepEqual(resolveSearchOptions([plugin], []), { archiveOpenOnly: true })
  assert.deepEqual(resolveSearchOptions([plugin], ['pessoal.busca-ampla']), { archiveOpenOnly: false })
  assert.deepEqual(resolveSearchOptions([plugin], ['outro.plugin']), { archiveOpenOnly: true })
})

test('disabling goes back to the restrictive default', () => {
  const plugin = validateManifest(wide)
  let enabled = ['pessoal.busca-ampla']
  assert.equal(resolveSearchOptions([plugin], enabled).archiveOpenOnly, false)
  enabled = enabled.filter((id) => id !== 'pessoal.busca-ampla')
  assert.equal(resolveSearchOptions([plugin], enabled).archiveOpenOnly, true)
})

test('an explicit open-only effect never relaxes the filter', () => {
  const plugin = validateManifest({ ...wide, effects: [{ type: 'search.archive-license-filter', value: 'open-only' }] })
  assert.equal(resolveSearchOptions([plugin], [plugin.id]).archiveOpenOnly, true)
})

test('YouTube source is included only when an active manifest declares its permission and effect', () => {
  const youtube = {
    schemaVersion: 1,
    id: 'pessoal.youtube',
    name: 'YouTube',
    version: '1.0.0',
    author: 'Eu',
    description: 'Busca no YouTube.',
    kind: 'integration',
    permissions: ['sources.youtube'],
    effects: [{ type: 'source.youtube', value: 'on' }]
  }
  const plugin = validateManifest(youtube)
  assert.deepEqual(resolveSearchOptions([plugin], []), { archiveOpenOnly: true })
  assert.deepEqual(resolveSearchOptions([plugin], [plugin.id]), { archiveOpenOnly: true, youtube: true })
  assert.throws(() => validateManifest({ ...youtube, permissions: [] }), /exige a permissão sources\.youtube/)
})

test('archive query keeps the Creative Commons filter unless told otherwise', () => {
  assert.match(buildArchiveQuery('orochi'), /creativecommons\.org/)
  assert.match(buildArchiveQuery('orochi', true), /creativecommons\.org/)
  assert.doesNotMatch(buildArchiveQuery('orochi', false), /creativecommons/)
  assert.match(buildArchiveQuery('orochi', false), /mediatype:audio/)
})
