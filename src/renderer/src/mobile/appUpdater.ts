import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { AppUpdateState } from '@shared/types'
import { pickApkRelease } from '@shared/app-version'

interface AppUpdaterPlugin {
  canInstall(): Promise<{ allowed: boolean }>
  openInstallSettings(): Promise<void>
  download(options: { url: string; name: string }): Promise<{ path: string }>
  install(options: { path: string }): Promise<void>
  addListener(event: 'progress', listener: (data: { percent: number }) => void): Promise<PluginListenerHandle>
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')

const RELEASES_URL = 'https://api.github.com/repos/tklabs11/openfy/releases?per_page=10'

/**
 * Atualização do Android pela pré-release do GitHub: baixa o APK, mostra o
 * progresso e abre o instalador do sistema. O download e a instalação passam
 * pelo plugin nativo — o WebView não pode instalar nada sozinho.
 */
export function createMobileUpdater() {
  let state: AppUpdateState = { status: 'idle' }
  let listener: ((state: AppUpdateState) => void) | null = null
  let downloadedPath = ''
  let busy = false

  const publish = (next: AppUpdateState): void => {
    state = next
    listener?.(next)
  }

  if (Capacitor.isNativePlatform()) {
    void AppUpdater.addListener('progress', ({ percent }) => {
      if (state.status !== 'downloading' && state.status !== 'available') return
      publish({ status: 'downloading', version: state.version, percent })
    }).catch(() => {})
  }

  return {
    getState(): AppUpdateState {
      return state
    },

    onState(callback: (state: AppUpdateState) => void): () => void {
      listener = callback
      return () => { listener = null }
    },

    async check(): Promise<void> {
      if (!Capacitor.isNativePlatform() || busy) return
      busy = true
      downloadedPath = ''
      publish({ status: 'checking' })
      try {
        const response = await fetch(RELEASES_URL, { headers: { accept: 'application/vnd.github+json' } })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const release = pickApkRelease(await response.json(), __APP_VERSION__)
        if (!release) {
          publish({ status: 'not-available' })
          return
        }
        publish({ status: 'downloading', version: release.version, percent: 0 })
        const { path } = await AppUpdater.download({ url: release.url, name: release.name })
        downloadedPath = path
        publish({ status: 'downloaded', version: release.version, percent: 100 })
      } catch (error) {
        console.warn('[Openfy] Não foi possível verificar ou baixar a atualização:', error)
        publish({ status: 'error' })
      } finally {
        busy = false
      }
    },

    async install(): Promise<void> {
      if (!downloadedPath) {
        await this.check()
        if (!downloadedPath) return
      }
      const { allowed } = await AppUpdater.canInstall()
      if (!allowed) {
        // A tela do sistema só libera "instalar apps desconhecidos" para o Openfy.
        await AppUpdater.openInstallSettings()
        throw new Error('Permita instalar apps desconhecidos para o Openfy e toque em instalar novamente.')
      }
      await AppUpdater.install({ path: downloadedPath })
    }
  }
}
