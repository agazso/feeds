import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'
import { loadPostsCached } from '$lib/feed-cache'
import { tagShorts } from '$lib/shorts'

export const load: PageServerLoad = async ({ locals }) => {
  const config = await loadConfig(locals.user)
  const posts = tagShorts(await loadPostsCached(config.feeds, locals.user))
  const sorted = posts.sort((a, b) => b.createdAt - a.createdAt)

  return {
    posts: sorted.slice(0, config.maxPosts),
  }
}