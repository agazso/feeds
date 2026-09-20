import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { buildFeedUrlToPageUrl } from '$lib/tags'
import { transformPostImages } from '@feeds/core'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const posts = await loadMyfeedPosts(locals.user)
  const config = await loadConfig(locals.user)

  const transformedPosts = await Promise.all(
    posts.map((post) => transformPostImages(post, post.link || '')),
  )

  const sorted = transformedPosts.sort((a, b) => b.createdAt - a.createdAt)
  return { posts: sorted, feedUrlToPageUrl: buildFeedUrlToPageUrl(config.feeds) }
}
