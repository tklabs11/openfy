import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { mprisMicroseconds, mprisPlaybackStatus, mprisMetadata } =
  await importTypeScript('../src/shared/mpris.ts')

test('maps playback state to MPRIS status', () => {
  assert.equal(mprisPlaybackStatus(true), 'Playing')
  assert.equal(mprisPlaybackStatus(false), 'Paused')
})

test('converts seconds to MPRIS microseconds and rejects invalid values', () => {
  assert.equal(mprisMicroseconds(213), 213_000_000)
  assert.equal(mprisMicroseconds(0), 0)
  assert.equal(mprisMicroseconds(-5), 0)
  assert.equal(mprisMicroseconds(Number.NaN), 0)
})

test('builds track metadata with artist list and length', () => {
  assert.deepEqual(
    mprisMetadata({ playing: true, title: 'Carta Aberta', artist: 'MC Cabelinho', duration: 278, position: 42 }, '/org/mpris/MediaPlayer2/openfy/track/0'),
    {
      'mpris:trackid': '/org/mpris/MediaPlayer2/openfy/track/0',
      'xesam:title': 'Carta Aberta',
      'xesam:artist': ['MC Cabelinho'],
      'mpris:length': 278_000_000
    }
  )
})

test('metadata stays valid without a known duration', () => {
  const meta = mprisMetadata({ playing: false, title: '', artist: '', duration: 0, position: 0 }, '/track/0')
  assert.equal(meta['xesam:title'], 'Openfy')
  assert.deepEqual(meta['xesam:artist'], [])
  assert.equal(meta['mpris:length'], undefined)
})
