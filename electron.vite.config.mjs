import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    envPrefix: ['VITE_', 'PORCUPINE_', 'VOX_']
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: resolve('src/renderer/index.html'),
          voice: resolve('src/renderer/voice.html')
        }
      }
    }
  }
})
