import type { Track } from '../../shared/types'
import { getJson } from './http'
import { mapLibriVox } from './librivox-mapper'

const API = 'https://librivox.org/api/feed/audiobooks/'
const MAX_BOOKS = 10

export async function searchLibriVox(query: string): Promise<Track[]> {
  const q = query.trim()
  if (!q) return []
  const params = new URLSearchParams({
    title: `^${q.slice(0, 200)}`,
    format: 'json',
    extended: '1',
    coverart: '1',
    limit: String(MAX_BOOKS)
  })
  return mapLibriVox(await getJson(`${API}?${params}`))
}
