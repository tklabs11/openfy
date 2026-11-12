import { net } from 'electron'
import type { Track } from '../../shared/types'
import { parseInvidiousInstances, searchInvidiousInstances } from '../../shared/invidious'

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

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await net.fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (error instanceof Error && /^HTTP \d+$/.test(error.message)) throw error
    throw new Error('sem resposta em JSON')
  } finally {
    clearTimeout(timer)
  }
}

async function knownInstances(): Promise<string[]> {
  if (instanceCache && Date.now() - instanceCache.at < INSTANCES_TTL_MS) return instanceCache.list
  let discovered: string[] = []
  try {
    discovered = parseInvidiousInstances(await getJson(DISCOVERY_URL))
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
export async function searchInvidious(query: string, page = 1): Promise<Track[]> {
  const cacheKey = `${query.trim().toLowerCase()}|${page}`
  const hit = resultCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tracks

  const instances = await knownInstances()
  if (!instances.length) {
    lastError = 'Nenhuma instância pública do Invidious disponível no momento.'
    throw new Error(lastError)
  }
  try {
    const { tracks } = await searchInvidiousInstances(instances, getJson, query, page, MAX_ATTEMPTS, SEARCH_BUDGET_MS)
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
export async function checkInvidious(): Promise<{ ok: boolean; message: string }> {
  try {
    const { tracks, instance } = await searchInvidiousInstances(
      await knownInstances(),
      getJson,
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
