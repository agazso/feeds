import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { feedUrls, isSyndicationFormat, syndicate } from '$lib/server/syndication'
import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, url, locals }) => {
  if (!isSyndicationFormat(params.ext)) throw error(404, 'Not found')

  // Capped like /tags and /all-posts — the page renders every saved post, but a
  // reader polling this does not need the whole archive on each fetch.
  const config = await loadConfig(locals.user)
  const posts = (await loadMyfeedPosts(locals.user))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.maxPosts)

  return syndicate(params.ext, posts, {
    title: 'Feeds — my feed',
    ...feedUrls(url, params.ext),
  })
}
