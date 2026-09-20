import { json } from '@sveltejs/kit'
import { loadConfig } from '$lib/config'
import { loadPostsCached } from '$lib/feed-cache'
import { loadMyfeedPosts } from '$lib/myfeed'
import { tagShorts } from '$lib/shorts'
import {
  buildFeedUrlToPageUrl,
  filterFeedsByTags,
  filterPostsByTags,
  getAllTags,
  getTagsFromPosts,
} from '$lib/tags'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, locals }) => {
  const tagsParam = url.searchParams.get('tags') || ''
  const selectedTags = tagsParam.split('+').filter(Boolean).map(decodeURIComponent)

  const config = await loadConfig(locals.user)
  const filteredFeeds = filterFeedsByTags(config.feeds, selectedTags)
  const feedPosts = tagShorts(await loadPostsCached(filteredFeeds, locals.user))
  const myfeedPosts = await loadMyfeedPosts(locals.user)
  const filteredMyfeedPosts = filterPostsByTags(myfeedPosts, selectedTags)

  const allPosts = [...feedPosts, ...filteredMyfeedPosts]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.maxPosts)

  const feedTags = getAllTags(config.feeds)
  const myfeedTags = getTagsFromPosts(myfeedPosts)
  const allTags = [...new Set([...feedTags, ...myfeedTags])].sort()

  const feedUrlToPageUrl = buildFeedUrlToPageUrl(config.feeds)

  return json({
    posts: allPosts,
    allTags,
    feedCount: filteredFeeds.length,
    feedUrlToPageUrl,
  })
}
