import { page } from '$app/state'
import { userPrefix } from './user'

/**
 * Path prefix for the current user scope: `/@bob` under a user path, `''` in
 * single-user mode. Every in-app link and `fetch` must go through it, otherwise
 * navigating away from a user silently drops back into single-user mode.
 */
export function prefix(): string {
  return userPrefix(page.url.pathname)
}
