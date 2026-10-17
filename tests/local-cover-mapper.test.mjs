import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { matchITunesCover, retryAfterMilliseconds } = await importTypeScript('../src/main/local-cover-mapper.ts')

test('matches a cover by title and artist and upgrades its artwork size', () => {
  const result = matchITunesCover([
    { trackName: 'Blue Hour (Remastered)', artistName: 'The Example Band', artworkUrl100: 'https://is.example/art/100x100bb.jpg' },
    { trackName: 'Blue Hour', artistName: 'Another Artist', artworkUrl100: 'https://is.example/other/100x100bb.jpg' }
  ], 'Blue Hour', 'The Example Band')

  assert.equal(result, 'https://is.example/art/600x600bb.jpg')
})

test('rejects unrelated results and single-word titles without a known artist', () => {
  assert.equal(matchITunesCover([
    { trackName: 'Other Song', artistName: 'Artist', artworkUrl100: 'https://is.example/art/100x100bb.jpg' }
  ], 'Requested Song', 'Artist'), null)
  assert.equal(matchITunesCover([
    { trackName: 'Hello', artistName: 'Someone', artworkUrl100: 'https://is.example/art/100x100bb.jpg' }
  ], 'Hello', 'Artista desconhecido'), null)
})

test('parses and bounds Retry-After values', () => {
  assert.equal(retryAfterMilliseconds('30', 0), 30_000)
  assert.equal(retryAfterMilliseconds('1970-01-01T00:02:00Z', 0), 120_000)
  assert.equal(retryAfterMilliseconds('invalid', 0), 60_000)
  assert.equal(retryAfterMilliseconds('3600', 0), 30 * 60_000)
})
