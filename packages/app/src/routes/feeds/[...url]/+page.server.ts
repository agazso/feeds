import type { PageServerLoad } from './$types'
import { loadPosts } from '@feeds/core'
import { loadConfig } from '$lib/config'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params }) => {
  const feedUrl = params.url || ''

  if (!feedUrl) {
    throw error(400, 'Feed URL is required')
  }

  const config = await loadConfig()

  // Find the feed by url
  const feed = config.feeds.find(f => f.url === decodeURIComponent(feedUrl))

  if (!feed) {
    throw error(404, 'Feed not found')
  }

  // Load posts for this specific feed
  const posts = await loadPosts([feed])
  const sorted = posts.sort((a, b) => b.createdAt - a.createdAt)

  return {
    feed,
    posts: sorted.slice(0, config.maxPosts),
  }
}
