import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { mapLyricsResponse, mapTrackLyrics } = await importTypeScript('../src/main/lyrics-mapper.ts')

test('maps plain and synchronized lyrics from LRCLIB', () => {
  assert.deepEqual(mapTrackLyrics({
    plainLyrics: '  First line\nSecond line  ',
    syncedLyrics: '[00:01.00]First line\n[00:02.00]Second line'
  }), {
    plainLyrics: 'First line\nSecond line',
    syncedLyrics: '[00:01.00]First line\n[00:02.00]Second line'
  })
})

test('ignores empty or malformed lyrics and bounds response size', () => {
  assert.equal(mapTrackLyrics(null), null)
  assert.equal(mapTrackLyrics([]), null)
  assert.equal(mapTrackLyrics({ plainLyrics: '  ', syncedLyrics: null }), null)
  assert.equal(mapTrackLyrics({ plainLyrics: 'x'.repeat(100_001) })?.plainLyrics?.length, 100_000)
  assert.equal(mapTrackLyrics({ syncedLyrics: 'y'.repeat(100_001) })?.syncedLyrics?.length, 100_000)
})

test('returns rate-limit status and honors LRCLIB Retry-After', async () => {
  const result = await mapLyricsResponse(
    new Response(null, { status: 429, headers: { 'Retry-After': '12' } }),
    1_000
  )
  assert.deepEqual(result, { status: 'rate-limited', retryAfterMs: 12_000 })
})

test('uses a bounded fallback delay when LRCLIB omits Retry-After', async () => {
  const result = await mapLyricsResponse(new Response(null, { status: 429 }), 1_000)
  assert.deepEqual(result, { status: 'rate-limited', retryAfterMs: 60_000 })
})
