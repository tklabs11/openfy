import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { createLibraryBackup, mergeLibraryBackup, parseLibraryBackup } = await importTypeScript('../src/renderer/src/backup.ts')

const track = (id) => ({ id, title: id, artist: 'Artist', source: 'audius', uri: `https://example.test/${id}` })
const playlist = (id, trackIds, name = id) => ({ id, name, trackIds })
const backup = (tracks, liked = [], playlists = []) => parseLibraryBackup(createLibraryBackup({ tracks, liked, playlists }))

test('rejects invalid backups without partial data', () => {
  assert.throws(() => parseLibraryBackup({ format: 'openfy-library-backup', version: 99 }), /não é um backup válido/)
  assert.throws(() => backup([track('a'), track('a')]), /músicas duplicadas/)
  assert.throws(() => backup([track('a')], ['missing']), /favoritos sem uma faixa/)
  assert.throws(() => backup([{ ...track('local'), source: 'local', uri: 'https://example.test/audio.mp3' }]), /Endereço inválido/)
})

test('merges tracks, likes, and playlists without duplicates or replacing current preferences', () => {
  const current = {
    tracks: [track('a')],
    liked: ['a'],
    playlists: [playlist('mix', ['a'], 'Local name')],
    settings: { volume: 0.35 }
  }
  const imported = backup(
    [track('a'), track('b')],
    ['a', 'b'],
    [playlist('mix', ['b'], 'Backup name'), playlist('new', ['a', 'b'])]
  )
  const result = mergeLibraryBackup(current, imported)
  assert.deepEqual(result.db.tracks.map((item) => item.id), ['a', 'b'])
  assert.deepEqual(result.db.liked, ['a', 'b'])
  assert.deepEqual(result.db.playlists.map((item) => [item.id, item.name, item.trackIds]), [
    ['mix', 'Local name', ['a', 'b']],
    ['new', 'new', ['a', 'b']]
  ])
  assert.deepEqual(result.db.settings, { volume: 0.35 })
  assert.deepEqual(
    {
      addedTracks: result.addedTracks,
      addedLikes: result.addedLikes,
      addedPlaylists: result.addedPlaylists,
      updatedPlaylists: result.updatedPlaylists
    },
    { addedTracks: 1, addedLikes: 1, addedPlaylists: 1, updatedPlaylists: 1 }
  )
})
