import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE, isValidKey } from '$lib/server/auth'

function setAuthCookie(cookies: import('@sveltejs/kit').Cookies, key: string) {
  cookies.set(AUTH_COOKIE, key, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
  })
}

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
  const keyFromUrl = url.searchParams.get('key')

  if (keyFromUrl && isValidKey(keyFromUrl)) {
    setAuthCookie(cookies, keyFromUrl)
    // Redirect to a clean URL; the re-run reflects the new cookie via hooks.
    redirect(303, '/auth')
  }

  return {
    authEnabled: locals.authEnabled,
    authenticated: locals.authenticated,
    invalidKey: keyFromUrl != null && keyFromUrl.length > 0,
  }
}

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData()
    const key = String(data.get('key') ?? '').trim()

    if (!isValidKey(key)) {
      return fail(401, { invalid: true })
    }

    setAuthCookie(cookies, key)
    redirect(303, '/auth')
  },
  logout: async ({ cookies }) => {
    cookies.delete(AUTH_COOKIE, { path: '/' })
    redirect(303, '/auth')
  },
}
