import type { Reroute } from '@sveltejs/kit'
import { stripUser } from '$lib/user'

// Universal (server + client) so `/@bob/feeds` is served by the `/feeds` route on
// both SSR and client-side navigation. The user itself is recovered from the
// untouched `event.url` / `page.url` — see $lib/user.
export const reroute: Reroute = ({ url }) => stripUser(url.pathname)
