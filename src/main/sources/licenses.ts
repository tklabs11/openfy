/** Converte a URL de licença Creative Commons em rótulo legível. */
export function licenseFromUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  const m = url.match(/creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i)
  if (m) return `CC ${m[1].toUpperCase()} ${m[2]}`
  if (/creativecommons\.org\/publicdomain\/zero/i.test(url)) return 'CC0'
  if (/creativecommons\.org\/publicdomain\/mark/i.test(url)) return 'Domínio público'
  return undefined
}

/** Rótulo a partir dos campos do Openverse: license="by-sa", version="4.0". */
export function licenseFromCode(code: unknown, version?: unknown): string | undefined {
  if (typeof code !== 'string' || !code) return undefined
  const c = code.toLowerCase()
  if (c === 'cc0') return 'CC0'
  if (c === 'pdm') return 'Domínio público'
  return `CC ${c.toUpperCase()}${typeof version === 'string' && version ? ' ' + version : ''}`
}
