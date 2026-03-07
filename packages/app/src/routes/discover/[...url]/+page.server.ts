import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'

export const load: PageServerLoad = async ({ params }) => {
  // The rest parameter captures everything after /discover/
  // e.g., /discover/https://example.com → url = "https://example.com"
  const url = params.url || ''

  // Load available tags and existing feed URLs from config
  const config = await loadConfig()
  const tagSet = new Set<string>()
  const existingFeedUrls = new Set<string>()

  for (const feed of config.feeds) {
    existingFeedUrls.add(feed.feedUrl)
    if (feed.tags) {
      for (const tag of feed.tags) {
        tagSet.add(tag)
      }
    }
  }

  const availableTags = Array.from(tagSet).sort()

  return { url, availableTags, existingFeedUrls: Array.from(existingFeedUrls) }
}
