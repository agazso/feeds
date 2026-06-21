import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { loadConfig, saveConfig } from '$lib/config'

export const PATCH: RequestHandler = async ({ params, request }) => {
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
    const config = await loadConfig()

    // Match by feedUrl (unique key) first; fall back to url for older links
    const decoded = decodeURIComponent(feedUrl)
    const byFeedUrl = config.feeds.findIndex(f => f.feedUrl === decoded)
    const feedIndex = byFeedUrl !== -1 ? byFeedUrl : config.feeds.findIndex(f => f.url === decoded)

    if (feedIndex === -1) {
      return json({ error: 'Feed not found' }, { status: 404 })
    }

    // Update the feed's tags
    config.feeds[feedIndex].tags = tags

    await saveConfig(config)

    return json({ success: true, tags })
  } catch (e) {
    console.error('Failed to update feed tags:', e)
    return json({ error: 'Failed to update feed tags' }, { status: 500 })
  }
}
