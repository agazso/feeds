import type { Feed } from '@feeds/core'
import { resolveYoutubeChannelUrl } from '@feeds/core'
import { json } from '@sveltejs/kit'
import { loadConfig, saveConfig } from '$lib/config'
import type { RequestHandler } from './$types'

/** A YouTube channel feed url is not a channel page; the feed list links to the page. */
async function resolveUrl(feed: Feed): Promise<string> {
  if (
    /youtube\.com\/feeds\/videos\.xml/.test(feed.feedUrl) &&
    !/youtube\.com\/(@|channel\/|c\/|user\/)/.test(feed.url || '')
  ) {
    return (await resolveYoutubeChannelUrl(feed.feedUrl)) ?? feed.url
  }
  return feed.url
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json()
  // One feed from discovery, or many from an imported subscription list.
  const incoming: Feed[] = body.feeds ?? (body.feed ? [body.feed] : [])
  const bulk = Array.isArray(body.feeds)

  if (incoming.length === 0 || incoming.some((feed) => !feed?.feedUrl)) {
    return json({ error: 'Feed with feedUrl is required' }, { status: 400 })
  }

  try {
    const config = await loadConfig(locals.user)
    const known = new Set(config.feeds.map((f) => f.feedUrl))

    // Adding one feed twice is the user asking for something impossible, so it is an
    // error. In a batch it is routine — an import overlapping what you already follow
    // should add the rest — so those are skipped and counted instead.
    if (!bulk && known.has(incoming[0].feedUrl)) {
      return json({ error: 'Feed already exists' }, { status: 409 })
    }

    const added: string[] = []
    for (const feed of incoming) {
      if (known.has(feed.feedUrl)) continue
      known.add(feed.feedUrl)
      config.feeds.push({
        name: feed.name,
        url: await resolveUrl(feed),
        feedUrl: feed.feedUrl,
        favicon: feed.favicon,
        tags: feed.tags || [],
        enrich: feed.enrich === true,
      })
      added.push(feed.feedUrl)
    }

    await saveConfig(config, locals.user)

    return json({ success: true, added: added.length, skipped: incoming.length - added.length })
  } catch (e) {
    console.error('Failed to add feed:', e)
    return json({ error: 'Failed to add feed' }, { status: 500 })
  }
}
