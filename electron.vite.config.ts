import { readFileSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const packageMetadata: { version: string } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    define: { __APP_VERSION__: JSON.stringify(packageMetadata.version) },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
