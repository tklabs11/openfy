import { contextBridge, ipcRenderer } from 'electron'
import type { Db, MediaKey, OpenfyApi } from '../shared/types'

const api: OpenfyApi = {
  loadDb: () => ipcRenderer.invoke('db:load'),
  saveDb: (db: Db) => ipcRenderer.invoke('db:save', db),
  pickFiles: () => ipcRenderer.invoke('library:pickFiles'),
  pickFolder: () => ipcRenderer.invoke('library:pickFolder'),
  search: (q: string) => ipcRenderer.invoke('api:search', q),
  featured: () => ipcRenderer.invoke('api:featured'),
  desktopGetPreferences: () => ipcRenderer.invoke('desktop:getPreferences'),
  desktopSetPreferences: (prefs) => ipcRenderer.invoke('desktop:setPreferences', prefs),
  desktopUpdatePlayback: (playing, title, artist) => ipcRenderer.send('desktop:playback', { playing, title, artist }),
  onMediaKey: (cb) => {
    const handler = (_e: unknown, key: MediaKey): void => cb(key)
    ipcRenderer.on('media-key', handler)
    return () => ipcRenderer.removeListener('media-key', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
