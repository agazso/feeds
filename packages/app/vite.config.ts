import { sveltekit } from '@sveltejs/kit/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  plugins: [sveltekit()],
  // In dev, resolve @feeds/core to its TS source so Vite serves it directly instead
  // of the tsup-built dist. Under `tsup --watch` the dist files are rewritten
  // non-atomically, which Vite would read half-written / keep stale in optimizeDeps,
  // causing intermittent 500s until a `pnpm dev` restart. Prod build still uses dist.
  resolve:
    command === 'serve'
      ? {
          alias: {
            '@feeds/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
          },
        }
      : {},
}))
