import type { Handle } from '@sveltejs/kit'
import { getAuthState } from '$lib/server/auth'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const handle: Handle = async ({ event, resolve }) => {
  const { enabled, authenticated } = getAuthState(event.cookies)
  event.locals.authEnabled = enabled
  event.locals.authenticated = authenticated

  // Block all writes when auth is on and the user isn't authenticated.
  // Exempt /auth so the login form action itself can run.
  if (
    WRITE_METHODS.has(event.request.method) &&
    !authenticated &&
    event.url.pathname !== '/auth'
  ) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  return resolve(event)
}
