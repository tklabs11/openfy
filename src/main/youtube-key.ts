import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const keyFile = (): string => join(app.getPath('userData'), 'youtube-key.bin')
let cachedKey: string | null | undefined

export async function getYoutubeKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey
  let encrypted: Buffer
  try {
    encrypted = await fs.readFile(keyFile())
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      cachedKey = null
      return null
    }
    throw error
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('O armazenamento seguro do sistema não está disponível para ler a chave do YouTube.')
  }
  cachedKey = safeStorage.decryptString(encrypted)
  return cachedKey
}

export async function setYoutubeKey(key: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('O armazenamento seguro do sistema não está disponível; a chave não foi salva.')
  }
  await fs.writeFile(keyFile(), safeStorage.encryptString(key), { mode: 0o600 })
  cachedKey = key
}

export async function clearYoutubeKey(): Promise<void> {
  await fs.rm(keyFile(), { force: true })
  cachedKey = null
}
