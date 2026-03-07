import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'

export const load: PageServerLoad = async () => {
  const config = await loadConfig()
  return { feeds: config.feeds }
}
