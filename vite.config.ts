import { defineConfig } from 'vite'

// Shared Vite configuration merged by both vite.client.config.ts and
// vite.server.config.ts.
export default defineConfig({
  build: {
    target: 'es2023',
    emptyOutDir: true,
  },
})
