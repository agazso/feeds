import { loadMyfeedPosts } from '$lib/myfeed'
import { feedUrls, isSyndicationFormat, syndicate } from '$lib/server/syndication'
import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, url, locals }) => {
  if (!isSyndicationFormat(params.ext)) throw error(404, 'Not found')

  const posts = (await loadMyfeedPosts(locals.user)).sort((a, b) => b.createdAt - a.createdAt)

  return syndicate(params.ext, posts, {
    title: 'Feeds — my feed',
    ...feedUrls(url, params.ext),
  })
}
