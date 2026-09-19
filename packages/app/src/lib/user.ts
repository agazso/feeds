// Multi-user mode: a path may start with `/@name`, scoping everything after it to
// that user's data dir (see $lib/paths). Without the prefix the app stays in
// single-user mode and behaves exactly as before.
//
// The prefix is stripped by the `reroute` hook (src/hooks.ts) so one route tree
// serves both modes; the original path survives in event.url / page.url, which is
// where the user is read back from.

// Charset excludes `/` and `.` sequences, so a name can never escape DATA_DIR.
const USER_PATH = /^\/@([A-Za-z0-9_-]+)(?=\/|$)/

export function userFromPath(pathname: string): string | undefined {
  return USER_PATH.exec(pathname)?.[1]
}

/** '' in single-user mode, '/@bob' under a user path. Prefix for every in-app link. */
export function userPrefix(pathname: string): string {
  const user = userFromPath(pathname)
  return user ? `/@${user}` : ''
}

/** /@bob/myfeed → /myfeed */
export function stripUser(pathname: string): string {
  return pathname.slice(userPrefix(pathname).length) || '/'
}
