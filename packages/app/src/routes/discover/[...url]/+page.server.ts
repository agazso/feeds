import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { collectAvailableTags } from '$lib/tags'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals }) => {
  // The rest parameter captures everything after /discover/
  // e.g., /discover/https://example.com → url = "https://example.com"
  const url = params.url || ''

  const config = await loadConfig(locals.user)
  const myfeedPosts = await loadMyfeedPosts(locals.user)

  return {
    url,
    availableTags: collectAvailableTags(config.feeds, myfeedPosts),
    existingFeedUrls: config.feeds.map((feed) => feed.feedUrl),
    feeds: config.feeds,
    myfeedPosts,
  }
}
