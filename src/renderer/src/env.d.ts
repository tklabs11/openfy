import type { OpenfyApi } from '@shared/types'

declare global {
  const __APP_VERSION__: string

  interface Window {
    api: OpenfyApi
    /** Verdadeiro quando a interface roda no WebView do Android. */
    openfyMobile?: boolean
  }
}

export {}
