// Sem imports: este arquivo é testado isoladamente.

// Filtro padrão do projeto: só itens de áudio com licença Creative Commons.
export const LICENSE_FILTER = 'licenseurl:(*creativecommons.org*)'

/**
 * Monta a consulta do Internet Archive (usada quando a busca do site não responde).
 * Vários termos viram AND — com OR, "legiao urbana" trazia qualquer coisa com
 * "urbana" no título. A frase exata ganha reforço e a ordenação fina é feita depois
 * em archive-rank.ts.
 * `onlyOpen` = true mantém o filtro de licença (opcional).
 */
export const buildArchiveQuery = (terms: string | string[], onlyOpen: boolean = false): string => {
  const list = (Array.isArray(terms) ? terms : terms.split(/\s+/)).map((t) => t.trim()).filter(Boolean)
  const filter = 'mediatype:audio' + (onlyOpen ? ` AND ${LICENSE_FILTER}` : '')
  if (!list.length) return filter
  if (list.length === 1) return `(title:(${list[0]}) OR creator:(${list[0]}) OR subject:(${list[0]})) AND ${filter}`
  const all = list.join(' AND ')
  const phrase = list.join(' ')
  return (
    `(title:("${phrase}")^4 OR creator:("${phrase}")^3 OR title:(${all}) OR creator:(${all}) OR subject:(${all})) AND ${filter}`
  )
}

/**
 * Limpa a busca do usuário para a sintaxe Lucene do Archive: barras, aspas e
 * parênteses quebram a consulta inteira ("AC/DC", "guns n' roses").
 */
export const sanitizeArchiveQuery = (q: string): string =>
  q
    .replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

/** Identificadores dos itens na resposta da busca do site (services/search/beta). */
export const siteSearchIdentifiers = (data: unknown): string[] => {
  const hits = (data as { response?: { body?: { hits?: { hits?: unknown } } } })?.response?.body?.hits?.hits
  if (!Array.isArray(hits)) return []
  const out: string[] = []
  for (const hit of hits) {
    const id = (hit as { fields?: { identifier?: unknown } })?.fields?.identifier
    if (typeof id === 'string' && id.trim() && !out.includes(id)) out.push(id)
  }
  return out
}
