/* eslint-disable @typescript-eslint/no-explicit-any */
import { net } from 'electron'

/** GET JSON com timeout. Usa a pilha de rede do Electron (respeita proxy do sistema). */
export async function getJson(url: string, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await net.fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}
