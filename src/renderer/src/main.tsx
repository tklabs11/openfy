import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ensureBuiltinDefaults } from './plugin-sdk'
import './styles.css'

ensureBuiltinDefaults()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
