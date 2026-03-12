import type { PageServerLoad } from './$types'
import { loadPosts } from '@feeds/core'
import { loadConfig } from '$lib/config'
import {
  filterFeedsByTags,
  parseTagsFromPath,
  getAllTags,
  getTagsFromPosts,
  filterPostsByTags,
} from '$lib/tags'
import { loadMyfeedPosts } from '$lib/myfeed'

export const load: PageServerLoad = async ({ params }) => {
  const config = await loadConfig()
  const selectedTags = parseTagsFromPath(params.tags)

  // Load feed posts
  const filteredFeeds = filterFeedsByTags(config.feeds, selectedTags)
  const feedPosts = await loadPosts(filteredFeeds)

  // Load and filter myfeed posts
  const myfeedPosts = await loadMyfeedPosts()
  const filteredMyfeedPosts = filterPostsByTags(myfeedPosts, selectedTags)

  // Merge and sort all posts
  const allPosts = [...feedPosts, ...filteredMyfeedPosts]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.maxPosts)

  // Merge all tags for the selector
  const feedTags = getAllTags(config.feeds)
  const myfeedTags = getTagsFromPosts(myfeedPosts)
  const allTags = [...new Set([...feedTags, ...myfeedTags])].sort()

  return {
    posts: allPosts,
    selectedTags,
    allTags,
    feedCount: filteredFeeds.length,
  }
}
