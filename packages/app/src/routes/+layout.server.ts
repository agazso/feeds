import type { Layout, Theme } from '$lib/stores/preferences.svelte'
import type { LayoutServerLoad } from './$types'

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
