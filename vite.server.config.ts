import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config.ts'

// Vite config for bundling the Node web server (entry in ./server).
export default defineConfig(() =>
  mergeConfig(baseConfig, {
    root: 'server',
    build: {
      ssr: 'index.ts', // resolves to server/index.ts
      outDir: './dist/server', // resolves to <project>/dist/server
      target: 'node22',
    },
  }),
)
