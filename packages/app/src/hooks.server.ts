import { userExists } from '$lib/paths'
import { getAuthState } from '$lib/server/auth'
import { stripUser, userFromPath } from '$lib/user'
import type { Handle } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const handle: Handle = async ({ event, resolve }) => {
  // `reroute` stripped the /@name prefix off the route, so read the scope back off
  // the original path. Users are folders created out-of-band — unknown ones 404.
  const user = userFromPath(event.url.pathname)
  if (user && !(await userExists(user))) {
    error(404, `There is no @${user} here`)
  }
  event.locals.user = user

  const { enabled, authenticated } = await getAuthState(event.cookies, user)
  event.locals.authEnabled = enabled
  event.locals.authenticated = authenticated

  // Block all writes when auth is on and the user isn't authenticated.
  // Exempt /auth so the login form action itself can run.
  if (
    WRITE_METHODS.has(event.request.method) &&
    !authenticated &&
    stripUser(event.url.pathname) !== '/auth'
  ) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  return resolve(event)
}
