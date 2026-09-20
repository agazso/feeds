import type { Feed } from '@feeds/core'
import { resolveYoutubeChannelUrl } from '@feeds/core'
import { json } from '@sveltejs/kit'
import { loadConfig, saveConfig } from '$lib/config'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json()
  const feed: Feed = body.feed

  if (!feed || !feed.feedUrl) {
    return json({ error: 'Feed with feedUrl is required' }, { status: 400 })
  }

  try {
    const config = await loadConfig(locals.user)

    // Check if feed already exists
    const existingFeed = config.feeds.find((f) => f.feedUrl === feed.feedUrl)
    if (existingFeed) {
      return json({ error: 'Feed already exists' }, { status: 409 })
    }

    // Normalize a YouTube channel feed whose url isn't already a channel page
    let url = feed.url
    if (
      /youtube\.com\/feeds\/videos\.xml/.test(feed.feedUrl) &&
      !/youtube\.com\/(@|channel\/|c\/|user\/)/.test(url || '')
    ) {
      url = (await resolveYoutubeChannelUrl(feed.feedUrl)) ?? url
    }

    // Add the new feed
    config.feeds.push({
      name: feed.name,
      url,
      feedUrl: feed.feedUrl,
      favicon: feed.favicon,
      tags: feed.tags || [],
      enrich: feed.enrich === true,
    })

    await saveConfig(config, locals.user)

    return json({ success: true })
  } catch (e) {
    console.error('Failed to add feed:', e)
    return json({ error: 'Failed to add feed' }, { status: 500 })
  }
}
