import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { videoIdFromUri } = await importTypeScript('../src/shared/youtube.ts')

test('extracts video ids from YouTube links and rejects invalid ids', () => {
  assert.equal(videoIdFromUri('https://www.youtube.com/watch?v=M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(videoIdFromUri('https://youtu.be/M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(videoIdFromUri('M7lc1UVf-VE'), 'M7lc1UVf-VE')
  assert.equal(videoIdFromUri('https://www.youtube.com/watch?v=short'), null)
  assert.equal(videoIdFromUri('not a url'), null)
})
