import { fail, redirect } from '@sveltejs/kit'
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE, isValidKey, keyForUser } from '$lib/server/auth'
import { userPrefix } from '$lib/user'
import type { Actions, PageServerLoad } from './$types'

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

  // A key authenticates one scope only — the user whose /@name path we're on.
  if (keyFromUrl && (await isValidKey(keyFromUrl, locals.user))) {
    setAuthCookie(cookies, keyFromUrl)
    // Redirect to a clean URL; the re-run reflects the new cookie via hooks.
    redirect(303, `${userPrefix(url.pathname)}/auth`)
  }

  // The key for this scope, for the "sign in on another device" link. Only ever sent
  // to someone already holding it — they authenticated with it to get here.
  const prefix = userPrefix(url.pathname)
  const key =
    locals.authEnabled && locals.authenticated ? await keyForUser(locals.user ?? '') : undefined

  return {
    authEnabled: locals.authEnabled,
    authenticated: locals.authenticated,
    user: locals.user,
    signInUrl: key && `${url.origin}${prefix}/auth?key=${encodeURIComponent(key)}`,
    invalidKey: keyFromUrl != null && keyFromUrl.length > 0,
  }
}

export const actions: Actions = {
  login: async ({ request, url, cookies, locals }) => {
    const data = await request.formData()
    const key = String(data.get('key') ?? '').trim()

    if (!(await isValidKey(key, locals.user))) {
      return fail(401, { invalid: true })
    }

    setAuthCookie(cookies, key)
    redirect(303, `${userPrefix(url.pathname)}/auth`)
  },
  logout: async ({ url, cookies }) => {
    cookies.delete(AUTH_COOKIE, { path: '/' })
    redirect(303, `${userPrefix(url.pathname)}/auth`)
  },
}
