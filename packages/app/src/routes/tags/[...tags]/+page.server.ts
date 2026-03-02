import type { PageServerLoad } from './$types'
import { loadPosts } from '@feeds/core'
import { loadConfig } from '$lib/config'
import { filterFeedsByTags, parseTagsFromPath, getAllTags } from '$lib/tags'

export const load: PageServerLoad = async ({ params }) => {
  const config = await loadConfig()
  const selectedTags = parseTagsFromPath(params.tags)
  const filteredFeeds = filterFeedsByTags(config.feeds, selectedTags)
  const posts = await loadPosts(filteredFeeds)
  const sorted = posts.sort((a, b) => b.createdAt - a.createdAt)
  const allTags = getAllTags(config.feeds)

  return {
    posts: sorted.slice(0, config.maxPosts),
    selectedTags,
    allTags,
    feedCount: filteredFeeds.length,
  }
}
