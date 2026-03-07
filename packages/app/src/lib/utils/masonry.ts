import { browser } from '$app/environment'

export function supportsCSSMasonry(): boolean {
  if (!browser) return true // SSR: assume support
  return CSS.supports('grid-template-rows', 'masonry')
}
