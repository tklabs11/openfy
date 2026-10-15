import { autoUpdater } from 'electron-updater'
import type { AppUpdateState } from '../shared/types'

let state: AppUpdateState = { status: 'idle' }
let listener: ((state: AppUpdateState) => void) | null = null
let supported = false
let checkInProgress = false

function publish(next: AppUpdateState): void {
  state = next
  listener?.(state)
}

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.on('checking-for-update', () => {
  checkInProgress = true
  publish({ status: 'checking' })
})
autoUpdater.on('update-available', (info) => {
  publish({ status: 'available', version: info.version, percent: 0 })
})
autoUpdater.on('download-progress', (progress) => {
  publish({ status: 'downloading', percent: Math.min(100, Math.max(0, progress.percent)) })
})
autoUpdater.on('update-downloaded', (info) => {
  checkInProgress = false
  publish({ status: 'downloaded', version: info.version, percent: 100 })
})
autoUpdater.on('update-not-available', () => {
  checkInProgress = false
  publish({ status: 'not-available' })
})
autoUpdater.on('error', (error) => {
  checkInProgress = false
  console.error('[Openfy] Falha ao verificar ou baixar atualização:', error)
  publish({ status: 'error' })
})

export const appUpdates = {
  getState(): AppUpdateState {
    return state
  },
  setListener(nextListener: (state: AppUpdateState) => void): void {
    listener = nextListener
    listener(state)
  },
  initialize(isPackaged: boolean, platform: string, currentVersion: string): void {
    supported = isPackaged && platform === 'win32'
    if (!supported) {
      publish({ status: 'unsupported' })
      return
    }

    autoUpdater.allowPrerelease = currentVersion.includes('-')
    void this.check()
  },
  async check(): Promise<void> {
    if (!supported) {
      publish({ status: 'unsupported' })
      return
    }
    if (checkInProgress) return

    checkInProgress = true
    publish({ status: 'checking' })
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      checkInProgress = false
      console.error('[Openfy] Não foi possível verificar atualizações:', error)
      publish({ status: 'error' })
    }
  },
  install(): void {
    if (!supported || state.status !== 'downloaded') return
    autoUpdater.quitAndInstall()
  }
}
