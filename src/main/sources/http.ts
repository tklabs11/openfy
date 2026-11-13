/* eslint-disable @typescript-eslint/no-explicit-any */

export type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>

/** GET JSON com timeout; o chamador pode injetar a pilha de rede da plataforma. */
export async function getJson(
  url: string,
  timeoutMs = 12000,
  fetcher: HttpFetch = (input, init) => globalThis.fetch(input, init)
): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetcher(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}
