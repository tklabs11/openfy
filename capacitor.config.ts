import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.openfy.app',
  appName: 'Openfy',
  // Gerado por `npm run build:android`.
  webDir: 'out/android',
  android: {
    // O app só usa HTTPS; conteúdo misto fica bloqueado.
    allowMixedContent: false
  }
}

export default config
