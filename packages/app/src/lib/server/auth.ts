import type { Cookies } from '@sveltejs/kit'

export const AUTH_COOKIE = 'feeds-auth-key'
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/**
 * Valid auth keys from the FEEDS_AUTH_KEYS env var (comma-separated).
 * Empty list means authentication is disabled.
 */
export function getAuthKeys(): string[] {
  return (process.env.FEEDS_AUTH_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

/** Authentication is enabled only when at least one key is configured. */
export function isAuthEnabled(): boolean {
  return getAuthKeys().length > 0
}

export function isValidKey(key: string | undefined | null): boolean {
  if (!key) return false
  return getAuthKeys().includes(key)
}

export interface AuthState {
  enabled: boolean
  authenticated: boolean
}

/**
 * Resolve auth state from the request cookies. When auth is disabled, everyone is
 * treated as authenticated so write features stay available.
 */
export function getAuthState(cookies: Cookies): AuthState {
  const enabled = isAuthEnabled()
  const authenticated = !enabled || isValidKey(cookies.get(AUTH_COOKIE))
  return { enabled, authenticated }
}
