import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'
import { loadPostsCached } from '$lib/feed-cache'
import { tagShorts } from '$lib/shorts'

export const load: PageServerLoad = async () => {
  const config = await loadConfig()
  const posts = tagShorts(await loadPostsCached(config.feeds))
  const sorted = posts.sort((a, b) => b.createdAt - a.createdAt)

  return {
    posts: sorted.slice(0, config.maxPosts),
  }
}