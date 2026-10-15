import { contextBridge, ipcRenderer } from 'electron'
import type { AppUpdateState, Db, DiscordPresenceStatus, MediaKey, OpenfyApi } from '../shared/types'

const api: OpenfyApi = {
  loadDb: () => ipcRenderer.invoke('db:load'),
  saveDb: (db: Db) => ipcRenderer.invoke('db:save', db),
  pickFiles: () => ipcRenderer.invoke('library:pickFiles'),
  pickFolder: () => ipcRenderer.invoke('library:pickFolder'),
  search: (q: string) => ipcRenderer.invoke('api:search', q),
  featured: () => ipcRenderer.invoke('api:featured'),
  desktopGetPreferences: () => ipcRenderer.invoke('desktop:getPreferences'),
  desktopSetPreferences: (prefs) => ipcRenderer.invoke('desktop:setPreferences', prefs),
  desktopGetDiscordPresenceStatus: () => ipcRenderer.invoke('desktop:discordPresenceStatus'),
  onDiscordPresenceStatus: (cb) => {
    const handler = (_event: unknown, status: DiscordPresenceStatus): void => cb(status)
    ipcRenderer.on('desktop:discordPresenceStatus', handler)
    return () => ipcRenderer.removeListener('desktop:discordPresenceStatus', handler)
  },
  desktopGetUpdateState: () => ipcRenderer.invoke('app:update:state'),
  desktopCheckForUpdates: () => ipcRenderer.invoke('app:update:check'),
  desktopInstallUpdate: () => ipcRenderer.invoke('app:update:install'),
  onUpdateState: (cb) => {
    const handler = (_event: unknown, state: AppUpdateState): void => cb(state)
    ipcRenderer.on('app:update:state', handler)
    return () => ipcRenderer.removeListener('app:update:state', handler)
  },
  desktopUpdatePlayback: (playing, title, artist, duration, position) =>
    ipcRenderer.send('desktop:playback', { playing, title, artist, duration, position }),
  onMediaKey: (cb) => {
    const handler = (_e: unknown, key: MediaKey): void => cb(key)
    ipcRenderer.on('media-key', handler)
    return () => ipcRenderer.removeListener('media-key', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
