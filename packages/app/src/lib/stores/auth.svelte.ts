// Client-side auth state, hydrated from server data in +layout.svelte.
// The auth cookie is httpOnly and set server-side; this store is read-only UI state
// used to show/hide write controls. The server (hooks.server.ts) is the real gate.
function createAuth() {
  let enabled = $state(false)
  let authenticated = $state(true)

  return {
    get enabled() {
      return enabled
    },
    get authenticated() {
      return authenticated
    },
    // Write features are available when auth is disabled or the user is authenticated.
    get canWrite() {
      return !enabled || authenticated
    },
    init(initialEnabled: boolean, initialAuthenticated: boolean) {
      enabled = initialEnabled
      authenticated = initialAuthenticated
    },
  }
}

export const auth = createAuth()
