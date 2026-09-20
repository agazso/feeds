import { loadConfig } from '$lib/config'
import { loadPostsCached } from '$lib/feed-cache'
import { loadMyfeedPosts } from '$lib/myfeed'
import { feedUrls, isSyndicationFormat, syndicate } from '$lib/server/syndication'
import { tagShorts } from '$lib/shorts'
import { filterFeedsByTags, filterPostsByTags, parseTagsFromPath } from '$lib/tags'
import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, url, locals }) => {
  if (!isSyndicationFormat(params.ext)) throw error(404, 'Not found')

  // Same selection as GET /api/tags, which is what the /tags page renders.
  const selectedTags = parseTagsFromPath(params.tags)
  const config = await loadConfig(locals.user)
  const feedPosts = tagShorts(
    await loadPostsCached(filterFeedsByTags(config.feeds, selectedTags), locals.user),
  )
  const myfeedPosts = filterPostsByTags(await loadMyfeedPosts(locals.user), selectedTags)
  const posts = [...feedPosts, ...myfeedPosts]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.maxPosts)

  return syndicate(params.ext, posts, {
    title: `Feeds — ${selectedTags.join(' + ') || 'all tags'}`,
    ...feedUrls(url, params.ext),
  })
}
