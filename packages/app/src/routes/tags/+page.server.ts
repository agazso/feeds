import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { getAllTags, getTagsFromPosts } from '$lib/tags'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const config = await loadConfig(locals.user)
  const myfeedPosts = await loadMyfeedPosts(locals.user)

  const feedTags = getAllTags(config.feeds)
  const myfeedTags = getTagsFromPosts(myfeedPosts)
  const tags = [...new Set([...feedTags, ...myfeedTags])].sort()

  return { tags }
}
