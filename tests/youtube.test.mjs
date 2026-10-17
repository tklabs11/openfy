import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { decodeEntities, videoIdFromUri, isKeyShape, mapYouTube, youtubeErrorMessage } =
  await importTypeScript('../src/shared/youtube.ts')

test('decodes HTML entities in video titles', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry &#39;live&#39; &quot;x&quot; &#x41;'), `Tom & Jerry 'live' "x" A`)
})

test('extracts video ids from YouTube links and rejects invalid ids', () => {
  assert.equal(videoIdFromUri('https://www.youtube.com/watch?v=M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(videoIdFromUri('https://youtu.be/M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(videoIdFromUri('M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(videoIdFromUri('https://www.youtube.com/watch?v=short'), null)
  assert.equal(videoIdFromUri('not a url'), null)
})

test('validates key shape and maps embeddable API items to YouTube tracks', () => {
  const fakeApiKey = ['AIza', 'SyA-', '1234567890', 'abcdefghijklmnopqrstu'].join('')
  assert.equal(isKeyShape(fakeApiKey), true)
  assert.equal(isKeyShape('key with spaces'), false)
  const tracks = mapYouTube({
    items: [
      { id: { videoId: 'M7lc1UVf-VE' }, snippet: { title: 'Voz &amp; Coração', channelTitle: 'Artista - Topic', liveBroadcastContent: 'none', thumbnails: { high: { url: 'http://i.ytimg.com/a.jpg' } } } },
      { id: { videoId: 'AAAAAAAAAAA' }, snippet: { title: 'Ao vivo', channelTitle: 'Canal', liveBroadcastContent: 'live' } },
      { id: { videoId: 'bad' }, snippet: { title: 'ID inválido' } }
    ]
  })
  assert.deepEqual(tracks, [{
    id: 'yt:M7lc1UVf-VE',
    title: 'Voz & Coração',
    artist: 'Artista',
    cover: 'https://i.ytimg.com/a.jpg',
    source: 'youtube',
    uri: 'https://www.youtube.com/watch?v=M7lc1UVf-VE'
  }])
})

test('translates API errors without exposing a key', () => {
  const quota = youtubeErrorMessage(403, { error: { errors: [{ reason: 'quotaExceeded' }], message: 'quota' } })
  assert.match(quota, /cota diária/)
  assert.match(youtubeErrorMessage(400, { error: { errors: [{ reason: 'keyInvalid' }], message: 'API key not valid' } }), /inválida/)
  assert.match(youtubeErrorMessage(403, { error: { errors: [{ reason: 'accessNotConfigured' }] } }), /não está ativada/)
  assert.match(youtubeErrorMessage(500, null), /HTTP 500/)
  assert.doesNotMatch(quota, /AIza/)
})
