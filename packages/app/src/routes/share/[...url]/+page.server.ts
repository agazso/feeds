import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'

export const load: PageServerLoad = async ({ params }) => {
  const url = params.url || ''

  // Load available tags from config
  const config = await loadConfig()
  const tagSet = new Set<string>()

  for (const feed of config.feeds) {
    if (feed.tags) {
      for (const tag of feed.tags) {
        tagSet.add(tag)
      }
    }
  }

  return {
    url: decodeURIComponent(url),
    availableTags: Array.from(tagSet).sort()
  }
}
