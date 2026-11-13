import type { SearchPage, Track } from '@shared/types'
import { readEnabled, readPlugins, resolveSearchOptions } from './plugin-sdk'

/** Busca de músicas respeitando os plugins ativos (o filtro de licença é uma preferência, desligada por padrão). */
export const searchTracks = (query: string): Promise<Track[]> =>
  window.api.search(query, resolveSearchOptions(readPlugins(), readEnabled()))

/** Uma página de resultados (1, 2, 3...), para o botão "Mostrar mais". */
export const searchTracksPage = (query: string, page: number): Promise<SearchPage> =>
  window.api.searchPage(query, { ...resolveSearchOptions(readPlugins(), readEnabled()), page })
