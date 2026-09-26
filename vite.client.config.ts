import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config.ts'

// Vite config for the browser client (app source in ./client).
export default defineConfig(() =>
  mergeConfig(baseConfig, {
    // The client app lives in ./client
    root: 'client',
    publicDir: './public',

    plugins: [
      tanstackRouter({
        // Both paths are resolved relative to the Vite root (./client above),
        // not the project root.
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: './src/routes',
        generatedRouteTree: './src/routeTree.gen.ts',
        routeFileIgnorePrefix: '-',
        quoteStyle: 'single',
      }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],

    build: {
      outDir: './dist/client',
    },
  }),
)
