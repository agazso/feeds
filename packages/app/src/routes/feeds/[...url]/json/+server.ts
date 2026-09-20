import { syndicateFeed } from '../syndicate'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = ({ params, url, locals }) =>
  syndicateFeed('json', params.url, url, locals.user)
