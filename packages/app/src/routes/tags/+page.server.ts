import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'
import { getAllTags, getTagsFromPosts } from '$lib/tags'
import { loadMyfeedPosts } from '$lib/myfeed'

export const load: PageServerLoad = async () => {
  const config = await loadConfig()
  const myfeedPosts = await loadMyfeedPosts()

  const feedTags = getAllTags(config.feeds)
  const myfeedTags = getTagsFromPosts(myfeedPosts)
  const tags = [...new Set([...feedTags, ...myfeedTags])].sort()

  return { tags }
}
