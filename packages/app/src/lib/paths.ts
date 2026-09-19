import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

// Runtime dirs are env-driven so the container can point them at a data volume.
// Defaults preserve dev/local behavior (static/ + cache/ next to the app).
export const DATA_DIR = process.env.FEEDS_DATA_DIR ?? join(process.cwd(), 'static')
export const CACHE_DIR = process.env.FEEDS_CACHE_DIR ?? join(process.cwd(), 'cache')
export const MODELS_DIR = process.env.FEEDS_MODELS_DIR ?? join(process.cwd(), 'models')

// A user's data and image cache live in an `@name` subdir. Single-user mode passes
// no user and keeps using the roots, so existing deployments are untouched.
export const dataDir = (user?: string) => (user ? join(DATA_DIR, `@${user}`) : DATA_DIR)
export const cacheDir = (user?: string) => (user ? join(CACHE_DIR, `@${user}`) : CACHE_DIR)

/** Users are the `@name` dirs under DATA_DIR — created out-of-band, never by the app. */
export async function listUsers(): Promise<string[]> {
  try {
    const entries = await readdir(DATA_DIR, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && e.name.startsWith('@'))
      .map((e) => e.name.slice(1))
      .sort()
  } catch {
    return []
  }
}

// ponytail: one readdir per request; cache it if DATA_DIR ever holds many users.
export async function userExists(user: string): Promise<boolean> {
  return (await listUsers()).includes(user)
}
