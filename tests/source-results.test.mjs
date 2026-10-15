import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { gatherSourceResults } = await importTypeScript('../src/main/sources/results.ts')

test('keeps successful source results when another source fails', async () => {
  const results = await gatherSourceResults([
    Promise.resolve(['track']),
    Promise.reject(new Error('source unavailable'))
  ])
  assert.deepEqual(results, [['track'], []])
})

test('reports a failure when all configured sources fail', async () => {
  await assert.rejects(
    gatherSourceResults([Promise.reject(new Error('one')), Promise.reject(new Error('two'))]),
    /Sem conexão com as fontes de música/
  )
})
