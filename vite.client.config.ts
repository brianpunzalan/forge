import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config.ts'

// Vite config for the browser client (app source in ./client).
export default defineConfig(() =>
  mergeConfig(baseConfig, {
    // The client app lives in ./client
    root: 'client',
    publicDir: './public',

    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],

    build: {
      outDir: './dist/client',
    },
  }),
)
