import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'

export const load: PageServerLoad = async ({ locals }) => {
  const config = await loadConfig(locals.user)
  return { feeds: config.feeds }
}
