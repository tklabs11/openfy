import type { Track } from '../../shared/types'
import { audioStreamOf, parseInvidiousInstances, searchInvidiousInstances } from '../../shared/invidious'
import { getJson as requestJson, type HttpFetch } from './http'

const DISCOVERY_URL = 'https://api.invidious.io/instances.json?sort_by=health'
/** Instâncias que já responderam com a API aberta; entram depois das descobertas. */
const SEED_INSTANCES = [
  'https://yt.chocolatemoo53.com',
  'https://invidious.materialio.us',
  'https://yewtu.be',
  'https://invidious.jing.rocks'
]
const INSTANCES_TTL_MS = 6 * 60 * 60 * 1_000
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000
const MAX_CACHE_ENTRIES = 100
const REQUEST_TIMEOUT_MS = 6_000
const SEARCH_BUDGET_MS = 12_000
const MAX_ATTEMPTS = 4

let lastError: string | null = null
export const invidiousLastError = (): string | null => lastError

let instanceCache: { at: number; list: string[] } | null = null
const resultCache = new Map<string, { at: number; tracks: Track[] }>()

async function getJson(url: string, fetcher?: HttpFetch): Promise<unknown> {
  try {
    return await requestJson(url, REQUEST_TIMEOUT_MS, fetcher)
  } catch (error) {
    if (error instanceof Error && /^HTTP \d+$/.test(error.message)) throw error
    throw new Error('sem resposta em JSON')
  }
}

async function knownInstances(fetcher?: HttpFetch): Promise<string[]> {
  if (instanceCache && Date.now() - instanceCache.at < INSTANCES_TTL_MS) return instanceCache.list
  let discovered: string[] = []
  try {
    discovered = parseInvidiousInstances(await getJson(DISCOVERY_URL, fetcher))
  } catch {
    // Sem a lista pública, as sementes conhecidas ainda permitem buscar.
  }
  const list = [...new Set([...discovered, ...SEED_INSTANCES])]
  if (list.length) instanceCache = { at: Date.now(), list }
  return list
}

function trim(): void {
  while (resultCache.size > MAX_CACHE_ENTRIES) {
    const oldest = resultCache.keys().next()
    if (oldest.done) break
    resultCache.delete(oldest.value)
  }
}

/** Busca no YouTube via instâncias públicas do Invidious, sem chave de API. */
export async function searchInvidious(query: string, page = 1, fetcher?: HttpFetch): Promise<Track[]> {
  const cacheKey = `${query.trim().toLowerCase()}|${page}`
  const hit = resultCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tracks

  const instances = await knownInstances(fetcher)
  if (!instances.length) {
    lastError = 'Nenhuma instância pública do Invidious disponível no momento.'
    throw new Error(lastError)
  }
  try {
    const { tracks } = await searchInvidiousInstances(
      instances,
      (url) => getJson(url, fetcher),
      query,
      page,
      MAX_ATTEMPTS,
      SEARCH_BUDGET_MS
    )
    lastError = null
    resultCache.set(cacheKey, { at: Date.now(), tracks })
    trim()
    return tracks
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
    throw error
  }
}

/** Verifica se alguma instância responde de verdade, para diagnóstico no Developer Mode. */
export async function checkInvidious(fetcher?: HttpFetch): Promise<{ ok: boolean; message: string }> {
  try {
    const { tracks, instance } = await searchInvidiousInstances(
      await knownInstances(fetcher),
      (url) => getJson(url, fetcher),
      'lofi',
      1,
      MAX_ATTEMPTS,
      SEARCH_BUDGET_MS
    )
    const host = new URL(instance).host
    lastError = null
    return { ok: true, message: `Busca funcionando via ${host} (${tracks.length} resultados de teste).` }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    lastError = message
    return { ok: false, message }
  }
}

const STREAM_TTL_MS = 30 * 60 * 1_000
const streamCache = new Map<string, { at: number; stream: { url: string; duration: number } | null }>()

/**
 * Stream só de áudio de um vídeo do YouTube. Serve para o Android continuar
 * tocando fora do app, onde o player oficial pausa a página oculta.
 * A URL vem presa ao IP de quem pediu, então precisa ser pedida no aparelho.
 */
export async function youtubeAudioStream(
  videoId: string,
  fetcher?: HttpFetch
): Promise<{ url: string; duration: number } | null> {
  if (!/^[\w-]{11}$/.test(videoId)) return null
  const cached = streamCache.get(videoId)
  if (cached && Date.now() - cached.at < STREAM_TTL_MS) return cached.stream

  let instances: string[] = []
  try {
    instances = await knownInstances(fetcher)
  } catch {
    return null
  }

  for (const instance of instances.slice(0, MAX_ATTEMPTS)) {
    try {
      const data = await getJson(`${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats,lengthSeconds`, fetcher)
      const stream = audioStreamOf(data)
      if (!stream) continue
      streamCache.set(videoId, { at: Date.now(), stream })
      return stream
    } catch {
      // Instância fora do ar ou sem o formato: tenta a próxima.
    }
  }
  return null
}
