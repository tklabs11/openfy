import type { SearchOptions, SearchPage, Track } from '../../shared/types'
import { searchArchive } from './archive'
import { gatherSourceResults } from './results'
import { filterByQuery, queryTokens } from './archive-rank'
import { searchYouTube } from './youtube'
import { getYoutubeKey } from '../youtube-key'

/** Intercala as listas (1º de cada fonte, 2º de cada fonte...) e remove duplicatas. */
export function mix(lists: Track[][]): Track[] {
  const out: Track[] = []
  const seen = new Set<string>()
  const max = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const l of lists) {
      const t = l[i]
      if (!t) continue
      const key = `${t.title}|${t.artist}`.toLowerCase().replace(/\s+/g, ' ').trim()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(t)
    }
  }
  return out
}

export const MAX_PAGES = 5

/** Internet Archive é a fonte padrão; YouTube só entra por plugin ativo e com chave salva. */
export async function searchPage(
  q: string,
  options: SearchOptions = { archiveOpenOnly: true }
): Promise<SearchPage> {
  const page = Math.min(MAX_PAGES, Math.max(1, Math.floor(options.page ?? 1)))
  const jobs: Promise<Track[]>[] = [searchArchive(q, options.archiveOpenOnly, page)]
  if (options.youtube) {
    jobs.push(getYoutubeKey().then((key) => key ? searchYouTube(q, key, page) : []))
  }
  const mixed = mix(await gatherSourceResults(jobs))
  const tracks = filterByQuery(mixed, queryTokens(q))
  return { tracks, hasMore: mixed.length > 0 && page < MAX_PAGES }
}

export async function search(q: string, options: SearchOptions = { archiveOpenOnly: true }): Promise<Track[]> {
  return (await searchPage(q, options)).tracks
}

export async function featured(): Promise<Track[]> {
  return []
}
