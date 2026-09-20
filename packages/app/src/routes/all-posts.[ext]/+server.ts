import { error } from '@sveltejs/kit'
import { loadConfig } from '$lib/config'
import { loadPostsCached } from '$lib/feed-cache'
import { feedUrls, isSyndicationFormat, syndicate } from '$lib/server/syndication'
import { tagShorts } from '$lib/shorts'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, url, locals }) => {
  if (!isSyndicationFormat(params.ext)) throw error(404, 'Not found')

  const config = await loadConfig(locals.user)
  const posts = tagShorts(await loadPostsCached(config.feeds, locals.user))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.maxPosts)

  return syndicate(params.ext, posts, {
    title: 'Feeds — all posts',
    ...feedUrls(url, params.ext),
  })
}
