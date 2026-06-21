import type { PageServerLoad } from './$types'
import { loadMyfeedPosts } from '$lib/myfeed'
import { loadConfig } from '$lib/config'
import { buildFeedUrlToPageUrl } from '$lib/tags'
import { transformPostImages } from '@feeds/core'

export const load: PageServerLoad = async () => {
  const posts = await loadMyfeedPosts()
  const config = await loadConfig()

  const transformedPosts = await Promise.all(
    posts.map((post) => transformPostImages(post, post.link || '')),
  )

  const sorted = transformedPosts.sort((a, b) => b.createdAt - a.createdAt)
  return { posts: sorted, feedUrlToPageUrl: buildFeedUrlToPageUrl(config.feeds) }
}
