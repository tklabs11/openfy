import { readFileSync } from 'node:fs'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const packageMetadata: { version: string } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

/** Build da interface para o WebView do Android (consumido pelo Capacitor). */
export default defineConfig({
  root: resolve('src/renderer'),
  base: './',
  define: { __APP_VERSION__: JSON.stringify(packageMetadata.version) },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main')
    }
  },
  plugins: [react()],
  build: {
    outDir: resolve('out/android'),
    emptyOutDir: true
  }
})
