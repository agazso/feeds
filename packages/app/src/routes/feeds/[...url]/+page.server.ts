import type { PageServerLoad } from './$types'
import { loadPosts } from '@feeds/core'
import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { getTagsFromPosts } from '$lib/tags'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params }) => {
  const feedUrl = params.url || ''

  if (!feedUrl) {
    throw error(400, 'Feed URL is required')
  }

  const config = await loadConfig()

  // Match by feedUrl (the unique key) first; fall back to url for older links.
  // url is not unique — e.g. many YouTube channels share https://www.youtube.com/
  const decoded = decodeURIComponent(feedUrl)
  const feed =
    config.feeds.find(f => f.feedUrl === decoded) ?? config.feeds.find(f => f.url === decoded)

  if (!feed) {
    throw error(404, 'Feed not found')
  }

  // Load posts for this specific feed
  const posts = await loadPosts([feed])
  const sorted = posts.sort((a, b) => b.createdAt - a.createdAt)

  // Collect available tags from all feeds
  const tagSet = new Set<string>()
  for (const f of config.feeds) {
    if (f.tags) {
      for (const tag of f.tags) {
        tagSet.add(tag)
      }
    }
  }

  // Add myfeed tags
  const myfeedPosts = await loadMyfeedPosts()
  for (const tag of getTagsFromPosts(myfeedPosts)) {
    tagSet.add(tag)
  }

  const availableTags = Array.from(tagSet).sort()

  return {
    feed,
    posts: sorted.slice(0, config.maxPosts),
    availableTags,
    feeds: config.feeds,
    myfeedPosts,
  }
}
