import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    watch: {
      // Ignore core's dist folder to prevent Vite from breaking when core rebuilds
      ignored: ['**/packages/core/dist/**'],
    },
  },
  optimizeDeps: {
    // Pre-bundle @feeds/core so Vite doesn't load it directly from filesystem
    include: ['@feeds/core'],
  },
  ssr: {
    // Also optimize @feeds/core for SSR
    optimizeDeps: {
      include: ['@feeds/core'],
    },
  },
})
