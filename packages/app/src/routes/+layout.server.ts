import type { LayoutServerLoad } from './$types'
import type { Theme, Layout } from '$lib/stores/preferences.svelte'

export const load: LayoutServerLoad = async ({ cookies }) => {
  const theme = (cookies.get('feeds-theme') as Theme) || 'dark'
  const layout = (cookies.get('feeds-layout') as Layout) || 'three-column'

  return {
    theme,
    layout,
  }
}
