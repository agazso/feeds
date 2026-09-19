import type { PageServerLoad } from './$types'
import { loadConfig, findFeedByKey } from '$lib/config'
import { loadPostsCached } from '$lib/feed-cache'
import { loadEnrichedFeedPosts } from '@feeds/core'
import { loadMyfeedPosts } from '$lib/myfeed'
import { collectAvailableTags } from '$lib/tags'
import { tagShorts } from '$lib/shorts'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params, locals }) => {
  const feedUrl = params.url || ''

  if (!feedUrl) {
    throw error(400, 'Feed URL is required')
  }

  const config = await loadConfig(locals.user)

  const feed = findFeedByKey(config.feeds, decodeURIComponent(feedUrl))

  if (!feed) {
    throw error(404, 'Feed not found')
  }

  // Link aggregators are enriched live here (and only here — /all-posts and /tags stay
  // on the cheap cached path, since enriching means one page fetch per item).
  const posts = tagShorts(
    feed.enrich
      ? await loadEnrichedFeedPosts(feed).catch(() => [])
      : await loadPostsCached([feed], locals.user),
  )
  const sorted = posts.sort((a, b) => b.createdAt - a.createdAt)

  const myfeedPosts = await loadMyfeedPosts(locals.user)
  const availableTags = collectAvailableTags(config.feeds, myfeedPosts)

  return {
    feed,
    posts: sorted.slice(0, config.maxPosts),
    availableTags,
    feeds: config.feeds,
    myfeedPosts,
  }
}
