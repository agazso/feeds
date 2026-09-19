import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { loadConfig, saveConfig, findFeedIndexByKey } from '$lib/config'

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const feedUrl = params.url || ''

  if (!feedUrl) {
    return json({ error: 'Feed URL is required' }, { status: 400 })
  }

  const body = await request.json()
  const { tags } = body

  if (!Array.isArray(tags)) {
    return json({ error: 'Tags must be an array' }, { status: 400 })
  }

  try {
    const config = await loadConfig(locals.user)

    const feedIndex = findFeedIndexByKey(config.feeds, decodeURIComponent(feedUrl))

    if (feedIndex === -1) {
      return json({ error: 'Feed not found' }, { status: 404 })
    }

    // Update the feed's tags
    config.feeds[feedIndex].tags = tags

    await saveConfig(config, locals.user)

    return json({ success: true, tags })
  } catch (e) {
    console.error('Failed to update feed tags:', e)
    return json({ error: 'Failed to update feed tags' }, { status: 500 })
  }
}
