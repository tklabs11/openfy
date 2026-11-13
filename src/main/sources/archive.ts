/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Track } from '../../shared/types'
import { getJson, type HttpFetch } from './http'
import { licenseFromUrl } from './licenses'
import { buildArchiveQuery, LICENSE_FILTER, sanitizeArchiveQuery, siteSearchIdentifiers } from './archive-query'
import { queryTokens, recallTerms, scoreTrack, selectTracks } from './archive-rank'
import { mapPool } from './pool'

// Mesma busca do site (archive.org/search): relevância do próprio Archive.
const SITE_SEARCH = 'https://archive.org/services/search/beta/page_production/'
// Reserva: usada só quando a busca do site não responde.
const SEARCH = 'https://archive.org/advancedsearch.php'
const META = 'https://archive.org/metadata/'
const DOWNLOAD = 'https://archive.org/download/'

const ROWS_SINGLE = 20
const ROWS_MULTI = 30
const MAX_FILES = 80
const PER_ITEM = 12
const MAX_TOTAL = 40
const POOL = 6
const BUDGET_MS = 7000

const metaCache = new Map<string, Track[]>()
const remember = (id: string, tracks: Track[]): void => {
  if (metaCache.size >= 400) metaCache.delete(metaCache.keys().next().value as string)
  metaCache.set(id, tracks)
}

/** Tira caracteres especiais da sintaxe de busca (Lucene) para não quebrar a consulta. */
export const cleanTerms = (q: string): string =>
  q
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ')

/** "237.45" ou "3:57" ou "1:02:03" → segundos. */
export function parseLength(v: unknown): number | undefined {
  if (typeof v !== 'string' || !v) return undefined
  if (v.includes(':')) {
    const parts = v.split(':').map(Number)
    if (parts.some((n) => !Number.isFinite(n))) return undefined
    return Math.round(parts.reduce((a, n) => a * 60 + n, 0))
  }
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

/** Tira a extensão do arquivo quando o título é só o nome do arquivo ("Faixa.mp3" → "Faixa"). */
export const stripExt = (t: string): string => t.replace(/\.(mp3|ogg|oga|flac|wav|m4a|aac|opus)$/i, '').trim()

const first = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : typeof v === 'string' ? v : '')

export function tracksFromMetadata(id: string, d: any): Track[] {
  const meta = d?.metadata ?? {}
  if (String(meta['access-restricted-item']).toLowerCase() === 'true') return []
  const itemTitle = first(meta.title) || id
  const itemArtist = first(meta.creator)
  const license = licenseFromUrl(first(meta.licenseurl))
  const seen = new Set<string>()
  const out: Track[] = []
  for (const f of Array.isArray(d?.files) ? d.files : []) {
    if (out.length >= MAX_FILES) break
    if (typeof f?.name !== 'string' || !/mp3/i.test(String(f.format ?? ''))) continue
    if (seen.has(f.name)) continue
    seen.add(f.name)
    const path = f.name.split('/').map(encodeURIComponent).join('/')
    out.push({
      id: `ia:${id}/${f.name}`,
      title: stripExt(first(f.title) || '') || stripExt(f.name.split('/').pop() ?? '') || itemTitle,
      artist: first(f.creator) || itemArtist,
      album: itemTitle,
      cover: `https://archive.org/services/img/${encodeURIComponent(id)}`,
      source: 'archive',
      uri: `${DOWNLOAD}${encodeURIComponent(id)}/${path}`,
      duration: parseLength(f.length),
      license
    })
  }
  return out
}

/**
 * Identificadores dos itens que casam com a busca, na mesma ordenação de
 * relevância do site. Se a busca do site falhar, cai para o advancedsearch.
 */
async function searchItemIds(q: string, onlyOpen: boolean, page: number, rows: number, fetcher?: HttpFetch): Promise<string[]> {
  const cleaned = sanitizeArchiveQuery(q)
  if (!cleaned) return []
  const filter = 'mediatype:audio' + (onlyOpen ? ` AND ${LICENSE_FILTER}` : '')
  const query = `${cleaned} AND ${filter}`

  try {
    const p = new URLSearchParams({
      user_query: query,
      hits_per_page: String(rows),
      page: String(page),
      aggregations: 'false'
    })
    const ids = siteSearchIdentifiers(await getJson(`${SITE_SEARCH}?${p}`, 12000, fetcher))
    if (ids.length) return ids
  } catch {
    // Busca do site fora do ar: tenta a consulta clássica abaixo.
  }

  const words = recallTerms(cleanTerms(q))
  if (!words.length) return []
  const p = new URLSearchParams({
    q: buildArchiveQuery(words, onlyOpen),
    rows: String(rows),
    page: String(page),
    output: 'json'
  })
  p.append('fl[]', 'identifier')
  const res = await getJson(`${SEARCH}?${p}`, 12000, fetcher)
  return (res?.response?.docs ?? []).map((d: any) => d?.identifier).filter(Boolean)
}

export async function searchArchive(
  q: string,
  onlyOpen: boolean = false,
  page: number = 1,
  fetcher?: HttpFetch
): Promise<Track[]> {
  const terms = queryTokens(q)
  if (!terms.length) return []
  const ids = await searchItemIds(q, onlyOpen, Math.max(1, Math.floor(page)), terms.length > 1 ? ROWS_MULTI : ROWS_SINGLE, fetcher)

  const lists = await mapPool(ids, POOL, async (id) => {
    const cached = metaCache.get(id)
    if (cached) return cached
    const tracks = tracksFromMetadata(id, await getJson(META + encodeURIComponent(id), 6000, fetcher))
    remember(id, tracks)
    return tracks
  }, BUDGET_MS)
  // A ordem dos itens já é a relevância do site: mantém e ordena só dentro de cada item.
  // Item do próprio artista rende o disco inteiro; o resto vira amostra de 3 faixas,
  // para um item que só cita o nome na descrição não encher a lista de música alheia.
  const picked: Track[] = []
  for (const list of lists) {
    if (!list?.length) continue
    const byArtist = scoreTrack(terms, { title: '', artist: list[0].artist, album: '' }) > 0
    picked.push(...selectTracks(list, terms, byArtist ? PER_ITEM : 3))
  }
  return picked.slice(0, MAX_TOTAL)
}
