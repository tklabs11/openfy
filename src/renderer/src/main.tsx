import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ensureBuiltinDefaults } from './plugin-sdk'
import './styles.css'

async function bootstrap(): Promise<void> {
  // Fora do Electron (Android) a ponte do preload não existe: registra a API do WebView.
  // O import dinâmico evita embarcar as fontes de busca no bundle do desktop.
  if (!window.api) {
    const { installMobileApi } = await import('./mobile/api')
    installMobileApi()
  }
  ensureBuiltinDefaults()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void bootstrap()
