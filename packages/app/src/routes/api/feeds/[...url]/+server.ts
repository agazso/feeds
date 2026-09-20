import { findFeedIndexByKey, loadConfig, saveConfig } from '$lib/config'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const feedUrl = params.url || ''

  if (!feedUrl) {
    return json({ error: 'Feed URL is required' }, { status: 400 })
  }

  const body = await request.json()
  const { tags, enrich } = body

  if (tags !== undefined && !Array.isArray(tags)) {
    return json({ error: 'Tags must be an array' }, { status: 400 })
  }
  if (enrich !== undefined && typeof enrich !== 'boolean') {
    return json({ error: 'Enrich must be a boolean' }, { status: 400 })
  }
  if (tags === undefined && enrich === undefined) {
    return json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const config = await loadConfig(locals.user)

    const feedIndex = findFeedIndexByKey(config.feeds, decodeURIComponent(feedUrl))

    if (feedIndex === -1) {
      return json({ error: 'Feed not found' }, { status: 404 })
    }

    if (tags !== undefined) config.feeds[feedIndex].tags = tags
    if (enrich !== undefined) config.feeds[feedIndex].enrich = enrich

    await saveConfig(config, locals.user)

    return json({ success: true, tags: config.feeds[feedIndex].tags, enrich })
  } catch (e) {
    console.error('Failed to update feed tags:', e)
    return json({ error: 'Failed to update feed tags' }, { status: 500 })
  }
}
