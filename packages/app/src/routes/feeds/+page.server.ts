import { loadConfig } from '$lib/config'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const config = await loadConfig(locals.user)
  return { feeds: config.feeds }
}
