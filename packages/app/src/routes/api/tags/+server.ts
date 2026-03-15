import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { loadPosts } from '@feeds/core'
import { loadConfig } from '$lib/config'
import {
  filterFeedsByTags,
  getAllTags,
  getTagsFromPosts,
  filterPostsByTags,
} from '$lib/tags'
import { loadMyfeedPosts } from '$lib/myfeed'

export const GET: RequestHandler = async ({ url }) => {
  const tagsParam = url.searchParams.get('tags') || ''
  const selectedTags = tagsParam.split('+').filter(Boolean).map(decodeURIComponent)

  const config = await loadConfig()
  const filteredFeeds = filterFeedsByTags(config.feeds, selectedTags)
  const feedPosts = await loadPosts(filteredFeeds)
  const myfeedPosts = await loadMyfeedPosts()
  const filteredMyfeedPosts = filterPostsByTags(myfeedPosts, selectedTags)

  const allPosts = [...feedPosts, ...filteredMyfeedPosts]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.maxPosts)

  const feedTags = getAllTags(config.feeds)
  const myfeedTags = getTagsFromPosts(myfeedPosts)
  const allTags = [...new Set([...feedTags, ...myfeedTags])].sort()

  const feedUrlToPageUrl: Record<string, string> = {}
  for (const feed of config.feeds) {
    feedUrlToPageUrl[feed.feedUrl] = feed.url
  }

  return json({
    posts: allPosts,
    allTags,
    feedCount: filteredFeeds.length,
    feedUrlToPageUrl,
  })
}
