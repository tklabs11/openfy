import { net } from 'electron'
import type { LocalCoverLookupResult } from '../shared/types'
import { matchITunesCover, retryAfterMilliseconds } from './local-cover-mapper'

const API = 'https://itunes.apple.com/search'
const REQUEST_INTERVAL_MS = 4_000
const cache = new Map<string, LocalCoverLookupResult>()
const inFlight = new Map<string, Promise<LocalCoverLookupResult>>()
let nextRequestAt = 0
let rateLimitedUntil = 0
let unavailableUntil = 0

export function findLocalCover(title: string, artist: string): Promise<LocalCoverLookupResult> {
  const key = `${title.trim().toLocaleLowerCase()}|${artist.trim().toLocaleLowerCase()}`
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  const pending = inFlight.get(key)
  if (pending) return pending
  const now = Date.now()
  if (now < rateLimitedUntil) {
    return Promise.resolve({ status: 'rate-limited', retryAfterMs: rateLimitedUntil - now })
  }
  if (now < unavailableUntil) {
    return Promise.resolve({
      status: 'unavailable',
      message: 'O catálogo de capas está temporariamente indisponível. Você ainda pode escolher a capa manualmente.'
    })
  }

  const request = (async (): Promise<LocalCoverLookupResult> => {
    const waitMs = Math.max(0, nextRequestAt - Date.now())
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs))
    nextRequestAt = Date.now() + REQUEST_INTERVAL_MS
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const terms = [title, /^artista desconhecido$/i.test(artist.trim()) ? '' : artist].filter(Boolean).join(' ')
      const params = new URLSearchParams({ term: terms, media: 'music', entity: 'song', limit: '10' })
      const response = await net.fetch(`${API}?${params}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Openfy/0.1 (Electron desktop music player)' }
      })
      if (response.status === 429) {
        const retryAfterMs = retryAfterMilliseconds(response.headers.get('retry-after'))
        rateLimitedUntil = Date.now() + retryAfterMs
        return { status: 'rate-limited', retryAfterMs }
      }
      if (response.status === 403) {
        unavailableUntil = Date.now() + 15 * 60_000
        console.warn('[Openfy] O catálogo de capas recusou a consulta (HTTP 403).')
        return {
          status: 'unavailable',
          message: 'O catálogo de capas recusou as consultas neste momento. Tente mais tarde ou escolha a capa manualmente.'
        }
      }
      if (!response.ok) {
        console.warn(`[Openfy] O catálogo de capas respondeu com HTTP ${response.status}.`)
        unavailableUntil = Date.now() + 2 * 60_000
        return {
          status: 'unavailable',
          message: 'O catálogo de capas está temporariamente indisponível. Tente mais tarde ou escolha a capa manualmente.'
        }
      }
      const data: unknown = await response.json()
      const results = data && typeof data === 'object' && 'results' in data ? data.results : undefined
      const cover = matchITunesCover(results, title, artist)
      rateLimitedUntil = 0
      cache.set(key, cover ? { status: 'found', cover } : { status: 'not-found' })
      if (cache.size > 500) {
        const oldest = cache.keys().next()
        if (!oldest.done) cache.delete(oldest.value)
      }
      return cover ? { status: 'found', cover } : { status: 'not-found' }
    } catch (error) {
      console.warn('[Openfy] Falha de rede ao consultar o catálogo de capas:', error)
      const retryAfterMs = 60_000
      rateLimitedUntil = Date.now() + retryAfterMs
      return { status: 'rate-limited', retryAfterMs }
    } finally {
      clearTimeout(timeout)
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, request)
  return request
}
