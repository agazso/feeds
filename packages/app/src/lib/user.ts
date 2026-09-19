// Multi-user mode: a path may start with `/@name`, scoping everything after it to
// that user's data dir (see $lib/paths). Without the prefix the app stays in
// single-user mode and behaves exactly as before.
//
// The prefix is stripped by the `reroute` hook (src/hooks.ts) so one route tree
// serves both modes; the original path survives in event.url / page.url, which is
// where the user is read back from.

// A URL may capitalize the name; the canonical form is always lowercase. Latin
// letters, digits and underscore only — no dot, dash or slash, so a name can never
// escape the data dir nor collide across filesystems that fold case.
const USER_PATH = /^\/@([A-Za-z0-9_]+)(?=\/|$)/

/** Guard for any name about to be resolved against the filesystem. */
export function isValidUserName(user: string): boolean {
  return /^[a-z0-9_]+$/.test(user)
}

/** The lowercase canonical user, e.g. `/@Bob/feeds` → `bob`. */
export function userFromPath(pathname: string): string | undefined {
  return USER_PATH.exec(pathname)?.[1].toLowerCase()
}

/**
 * '' in single-user mode, '/@bob' under a user path. Prefix for every in-app link —
 * always lowercase, so following one canonicalizes a capitalized URL.
 */
export function userPrefix(pathname: string): string {
  const user = userFromPath(pathname)
  return user ? `/@${user}` : ''
}

/** /@bob/myfeed → /myfeed (case-insensitive, unlike slicing off `userPrefix`). */
export function stripUser(pathname: string): string {
  return pathname.slice(USER_PATH.exec(pathname)?.[0].length ?? 0) || '/'
}
