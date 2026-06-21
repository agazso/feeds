import type { PageServerLoad } from './$types'
import { loadPosts } from '@feeds/core'
import { loadConfig, findFeedByKey } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { collectAvailableTags } from '$lib/tags'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params }) => {
  const feedUrl = params.url || ''

  if (!feedUrl) {
    throw error(400, 'Feed URL is required')
  }

  const config = await loadConfig()

  const feed = findFeedByKey(config.feeds, decodeURIComponent(feedUrl))

  if (!feed) {
    throw error(404, 'Feed not found')
  }

  // Load posts for this specific feed
  const posts = await loadPosts([feed])
  const sorted = posts.sort((a, b) => b.createdAt - a.createdAt)

  const myfeedPosts = await loadMyfeedPosts()
  const availableTags = collectAvailableTags(config.feeds, myfeedPosts)

  return {
    feed,
    posts: sorted.slice(0, config.maxPosts),
    availableTags,
    feeds: config.feeds,
    myfeedPosts,
  }
}
