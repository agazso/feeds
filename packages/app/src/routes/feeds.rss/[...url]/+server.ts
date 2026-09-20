import { syndicateFeed } from '$lib/server/syndicate-feed'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = ({ params, url, locals }) =>
  syndicateFeed('rss', params.url, url, locals.user)
