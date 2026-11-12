import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { parseInvidiousInstances, mapInvidious, searchInvidiousInstances, searchUrl } =
  await importTypeScript('../src/shared/invidious.ts')

const video = {
  type: 'video',
  title: 'Voz & Coração',
  videoId: 'M7lc1UVf-VE',
  author: 'Artista - Topic',
  lengthSeconds: 213,
  liveNow: false,
  videoThumbnails: [
    { quality: 'high', url: 'https://inv.example/vi/M7lc1UVf-VE/hqdefault.jpg', width: 480, height: 360 },
    { quality: 'maxresdefault', url: 'https://inv.example/vi/M7lc1UVf-VE/maxresdefault.jpg', width: 1280, height: 720 }
  ]
}

test('keeps only healthy HTTPS instances with the API enabled', () => {
  const instances = parseInvidiousInstances([
    ['good.example', { type: 'https', api: true, uri: 'https://good.example/' }],
    ['noapi.example', { type: 'https', api: false, uri: 'https://noapi.example' }],
    ['down.example', { type: 'https', api: true, uri: 'https://down.example', monitor: { down: true } }],
    ['http.example', { type: 'http', api: true, uri: 'http://http.example' }],
    ['god.example', { type: 'https', api: true, uri: 'https://god.example' }],
    ['bad.example', { type: 'https', api: true, uri: 'https://bad.example/path' }],
    'lixo'
  ])
  assert.deepEqual(instances, ['https://good.example', 'https://god.example'])
  assert.deepEqual(parseInvidiousInstances({ error: 'indisponível' }), [])
})

test('maps Invidious videos to tracks, preferring the largest thumbnail', () => {
  const tracks = mapInvidious([
    video,
    { ...video, videoId: 'AAAAAAAAAAA', liveNow: true },
    { ...video, videoId: 'BBBBBBBBBBB', isUpcoming: true },
    { ...video, videoId: 'bad' },
    { ...video, type: 'playlist' }
  ], 'https://inv.example')
  assert.deepEqual(tracks, [{
    id: 'yt:M7lc1UVf-VE',
    title: 'Voz & Coração',
    artist: 'Artista',
    cover: 'https://inv.example/vi/M7lc1UVf-VE/maxresdefault.jpg',
    source: 'youtube',
    uri: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    duration: 213
  }])
})

test('falls back to a YouTube thumbnail when the instance omits thumbnails', () => {
  const [track] = mapInvidious([{ ...video, videoThumbnails: undefined }])
  assert.equal(track.cover, 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg')
  assert.equal(mapInvidious({ error: 'instância fora do ar' }).length, 0)
})

test('falls back to the next instance when one is down or rate limited', async () => {
  const calls = []
  const fetchJson = async (url) => {
    calls.push(url)
    if (url.startsWith('https://down.example')) throw new Error('HTTP 503')
    if (url.startsWith('https://limited.example')) return { error: 'Too many requests' }
    return [video]
  }
  const result = await searchInvidiousInstances(
    ['https://down.example', 'https://limited.example', 'https://ok.example'],
    fetchJson,
    'lofi',
    2
  )
  assert.equal(result.instance, 'https://ok.example')
  assert.equal(result.tracks.length, 1)
  assert.equal(calls.length, 3)
  assert.equal(calls[2], searchUrl('https://ok.example', 'lofi', 2))
  assert.match(calls[2], /page=2/)
})

test('reports failure when every instance fails', async () => {
  await assert.rejects(
    searchInvidiousInstances(['https://down.example'], async () => { throw new Error('HTTP 502') }, 'lofi', 1),
    /Nenhuma instância pública do Invidious respondeu.*HTTP 502/s
  )
})
