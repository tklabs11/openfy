/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Track } from '../../shared/types'

const MAX_TRACKS = 100

const https = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const url = new URL(value.replace(/^http:\/\//i, 'https://'))
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const isArchiveUrl = (value: string): boolean => {
  const hostname = new URL(value).hostname
  return hostname === 'archive.org' || hostname.endsWith('.archive.org')
}

const seconds = (value: unknown): number | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const duration = Number(value)
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined
}

const authors = (value: unknown): string => {
  if (!Array.isArray(value)) return ''
  return value
    .map((author: any) => [author?.first_name, author?.last_name]
      .map((part) => typeof part === 'string' ? part.trim() : '')
      .filter(Boolean)
      .join(' '))
    .filter(Boolean)
    .join(', ')
}

export function mapLibriVox(response: any): Track[] {
  const tracks: Track[] = []
  for (const book of Array.isArray(response?.books) ? response.books : []) {
    if (typeof book?.id !== 'string' && typeof book?.id !== 'number') continue
    const bookTitle = typeof book.title === 'string' && book.title.trim() ? book.title.trim() : 'Audiolivro'
    const author = authors(book.authors)
    const cover = https(book.coverart_thumbnail) ?? https(book.coverart_jpg)
    for (const section of Array.isArray(book.sections) ? book.sections : []) {
      if (tracks.length >= MAX_TRACKS) return tracks
      const uri = https(section?.listen_url)
      if (!uri || !isArchiveUrl(uri)) continue
      const sectionId = section.id ?? section.section_number
      if (sectionId === undefined || sectionId === null) continue
      const chapter = typeof section.title === 'string' && section.title.trim()
        ? section.title.trim()
        : `Capítulo ${section.section_number ?? ''}`.trim()
      tracks.push({
        id: `lv:${book.id}:${sectionId}`,
        title: chapter,
        artist: author || 'LibriVox',
        album: bookTitle,
        cover,
        source: 'librivox',
        uri,
        duration: seconds(section.playtime),
        license: 'Domínio público (EUA)'
      })
    }
  }
  return tracks
}
