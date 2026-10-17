// Sem imports: este arquivo é testado isoladamente.

// Filtro padrão do projeto: só itens de áudio com licença Creative Commons.
export const LICENSE_FILTER = 'licenseurl:(*creativecommons.org*)'

/**
 * Monta a consulta do Internet Archive. Vários termos viram OR: o próprio Archive põe no topo
 * os itens que casam com mais termos, e a ordenação fina é feita depois (archive-rank.ts).
 * `onlyOpen` = true mantém o filtro de licença (padrão).
 */
export const buildArchiveQuery = (terms: string | string[], onlyOpen: boolean = true): string => {
  const group = Array.isArray(terms) ? terms.join(' OR ') : terms
  return (
    `(title:(${group}) OR creator:(${group}) OR subject:(${group}) OR description:(${group})) AND mediatype:audio` +
    (onlyOpen ? ` AND ${LICENSE_FILTER}` : '')
  )
}
