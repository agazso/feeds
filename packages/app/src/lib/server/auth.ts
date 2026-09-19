import type { Cookies } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../paths'

export const AUTH_COOKIE = 'feeds-auth-key'
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/**
 * `DATA_DIR/users.json` maps each user to the key that may write in its scope:
 *
 *   { "": "root-key", "bob": "bob-key", "alice": "alice-key" }
 *
 * The entry named `""` is the single-user (no `/@name` prefix) scope. Reading is
 * never gated — any scope is readable by anyone. A missing or empty file disables
 * auth entirely, leaving every scope writable.
 */
type KeyFile = Record<string, string>

const KEY_FILE = join(DATA_DIR, 'users.json')

// ponytail: read once per process; restart to pick up edits made outside the app.
// `createKey` refreshes it, so invites take effect immediately.
let keys: Promise<KeyFile> | undefined

function loadKeys(): Promise<KeyFile> {
  keys ??= readFile(KEY_FILE, 'utf-8')
    .then((content) => JSON.parse(content) as KeyFile)
    .catch(() => ({}))
  return keys
}

export async function keyForUser(user: string): Promise<string | undefined> {
  return (await loadKeys())[user]
}

/** Mint and persist a write key for `user`. Overwrites any key they already had. */
// ponytail: last write wins if two invites race; this is a single-admin app.
export async function createKey(user: string): Promise<string> {
  const updated = { ...(await loadKeys()), [user]: randomBytes(24).toString('hex') }
  await writeFile(KEY_FILE, JSON.stringify(updated, null, 2))
  keys = Promise.resolve(updated)
  return updated[user]
}

/**
 * Gate for pages that hand out keys (`/invite`). Unlike every other read in the app
 * these are not public: only the holder of the root key, in the root scope, gets in.
 */
export async function requireRootScope(locals: App.Locals): Promise<void> {
  if ((await keyForUser('')) === undefined) {
    error(403, 'Set a root key in users.json before inviting users')
  }
  if (locals.user || !locals.authenticated) {
    error(403, 'Only the root user can invite users')
  }
}

/** Authentication is enabled only when at least one key is configured. */
export async function isAuthEnabled(): Promise<boolean> {
  return Object.keys(await loadKeys()).length > 0
}

export async function isValidKey(key: string | undefined | null, user?: string): Promise<boolean> {
  const expected = (await loadKeys())[user ?? '']
  return expected !== undefined && key === expected
}

export interface AuthState {
  enabled: boolean
  authenticated: boolean
}

/**
 * Resolve auth state for `user`'s scope from the request cookies. When auth is
 * disabled, everyone is treated as authenticated so write features stay available.
 * A user with no entry in the keyfile is read-only for everyone.
 */
export async function getAuthState(cookies: Cookies, user?: string): Promise<AuthState> {
  const enabled = await isAuthEnabled()
  const authenticated = !enabled || (await isValidKey(cookies.get(AUTH_COOKIE), user))
  return { enabled, authenticated }
}
