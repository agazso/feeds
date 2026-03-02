import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'
import { getAllTags } from '$lib/tags'

export const load: PageServerLoad = async () => {
  const config = await loadConfig()
  const tags = getAllTags(config.feeds)

  return {
    tags,
  }
}
