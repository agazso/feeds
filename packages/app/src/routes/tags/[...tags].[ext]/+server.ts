import { error } from '@sveltejs/kit'
import { loadConfig } from '$lib/config'
import { loadPostsCached } from '$lib/feed-cache'
import { loadMyfeedPosts } from '$lib/myfeed'
import { opmlFilename, opmlResponse } from '$lib/server/opml'
import { feedUrls, isSyndicationFormat, syndicate } from '$lib/server/syndication'
import { tagShorts } from '$lib/shorts'
import { filterFeedsByTags, filterPostsByTags, parseTagsFromPath } from '$lib/tags'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const selectedTags = parseTagsFromPath(params.tags)
  const config = await loadConfig(locals.user)

  // OPML is a list of feeds, not of posts, so it stops here: saved posts carry tags
  // too, but they are not subscriptions and have nothing to export.
  if (params.ext === 'opml') {
    const feeds = filterFeedsByTags(config.feeds, selectedTags)
    return opmlResponse(feeds, opmlFilename(selectedTags), opmlTitle(selectedTags))
  }

  if (!isSyndicationFormat(params.ext)) throw error(404, 'Not found')

  // Same selection as GET /api/tags, which is what the /tags page renders.
  const feedPosts = tagShorts(
    await loadPostsCached(filterFeedsByTags(config.feeds, selectedTags), locals.user),
  )
  const myfeedPosts = filterPostsByTags(await loadMyfeedPosts(locals.user), selectedTags)
  const posts = [...feedPosts, ...myfeedPosts]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.maxPosts)

  return syndicate(params.ext, posts, {
    title: opmlTitle(selectedTags),
    ...feedUrls(url, params.ext),
  })
}

function opmlTitle(tags: string[]): string {
  return `Feeds — ${tags.join(' + ') || 'all tags'}`
}
