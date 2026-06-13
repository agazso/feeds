import type { LayoutServerLoad } from './$types'
import type { Theme, Layout } from '$lib/stores/preferences.svelte'

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
  const theme = (cookies.get('feeds-theme') as Theme) || 'dark'
  const layout = (cookies.get('feeds-layout') as Layout) || 'three-column'

  return {
    theme,
    layout,
    authEnabled: locals.authEnabled,
    authenticated: locals.authenticated,
  }
}
