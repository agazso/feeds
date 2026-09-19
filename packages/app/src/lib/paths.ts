import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isValidUserName } from './user'

// Runtime dirs are env-driven so the container can point them at a data volume.
// Defaults preserve dev/local behavior (static/ + cache/ next to the app).
export const DATA_DIR = process.env.FEEDS_DATA_DIR ?? join(process.cwd(), 'static')
export const CACHE_DIR = process.env.FEEDS_CACHE_DIR ?? join(process.cwd(), 'cache')
export const MODELS_DIR = process.env.FEEDS_MODELS_DIR ?? join(process.cwd(), 'models')

// A user's data and image cache live in an `@name` subdir. Single-user mode passes
// no user and keeps using the roots, so existing deployments are untouched.
// Names are re-validated here so an unchecked one can never reach `join`.
function userSubdir(root: string, user?: string): string {
  if (!user) return root
  if (!isValidUserName(user)) throw new Error(`invalid user name: ${user}`)
  return join(root, `@${user}`)
}

export const dataDir = (user?: string) => userSubdir(DATA_DIR, user)
export const cacheDir = (user?: string) => userSubdir(CACHE_DIR, user)

/**
 * Users are the `@name` dirs under DATA_DIR — made by hand or by `/invite`, never as a
 * side effect of visiting a path. A dir whose name isn't a valid user (uppercase, dots,
 * dashes) is not a user: it would never be reachable, since a path resolves to the
 * lowercase name.
 */
export async function listUsers(): Promise<string[]> {
  try {
    const entries = await readdir(DATA_DIR, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && e.name.startsWith('@'))
      .map((e) => e.name.slice(1))
      .filter(isValidUserName)
      .sort()
  } catch {
    return []
  }
}

// ponytail: one readdir per request; cache it if DATA_DIR ever holds many users.
export async function userExists(user: string): Promise<boolean> {
  return (await listUsers()).includes(user)
}
