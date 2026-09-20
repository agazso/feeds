import { loadConfig } from '$lib/config'
import { opmlResponse } from '$lib/server/opml'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals }) => {
  const config = await loadConfig(locals.user)
  return opmlResponse(config.feeds, 'feeds', 'Feeds')
}
