// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      authEnabled: boolean
      authenticated: boolean
    }
  }
}

export {}
