// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Current user scope from a `/@name` path; undefined in single-user mode. */
      user?: string
      authEnabled: boolean
      authenticated: boolean
    }
  }
}

export {}
