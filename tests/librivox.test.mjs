import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { mapLibriVox } = await importTypeScript('../src/main/sources/librivox-mapper.ts')

test('maps audiobook chapters to playable tracks with book metadata', () => {
  const tracks = mapLibriVox({
    books: [{
      id: '47',
      title: 'Count of Monte Cristo',
      authors: [{ first_name: 'Alexandre', last_name: 'Dumas' }],
      coverart_thumbnail: 'https://librivox.org/covers/47.jpg',
      sections: [{
        id: '121010',
        section_number: '1',
        title: 'Marseilles—The Arrival',
        listen_url: 'https://www.archive.org/download/count.mp3',
        playtime: '1179'
      }]
    }]
  })

  assert.deepEqual(tracks, [{
    id: 'lv:47:121010',
    title: 'Marseilles—The Arrival',
    artist: 'Alexandre Dumas',
    album: 'Count of Monte Cristo',
    cover: 'https://librivox.org/covers/47.jpg',
    source: 'librivox',
    uri: 'https://www.archive.org/download/count.mp3',
    duration: 1179,
    license: 'Domínio público (EUA)'
  }])
})

test('ignores non-Archive audio URLs and malformed entries', () => {
  const tracks = mapLibriVox({
    books: [{
      id: 1,
      title: 'Example',
      sections: [
        { id: 1, listen_url: 'https://notarchive.org/audio.mp3' },
        { id: 2, listen_url: 'javascript:alert(1)' },
        { id: 3, listen_url: 'https://archive.org/audio.mp3', title: ' Chapter 1 ' }
      ]
    }]
  })
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].title, 'Chapter 1')
  assert.equal(tracks[0].artist, 'LibriVox')
})

test('caps large audiobook search responses', () => {
  const sections = Array.from({ length: 120 }, (_, index) => ({
    id: index,
    listen_url: `https://archive.org/download/chapter-${index}.mp3`
  }))
  assert.equal(mapLibriVox({ books: [{ id: 1, sections }] }).length, 100)
})
