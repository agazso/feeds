import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchFeedsFromUrl, createEnrichedPost } from '@feeds/core'
import { transformPostImages } from '$lib/imageEmbed'

interface DiscoveredFeed {
  name: string
  url: string
  feedUrl: string
  favicon: string
}

async function discoverFeedFromUrl(url: string): Promise<DiscoveredFeed | null> {
  const originUrl = new URL(url).origin
  const feedResult = await fetchFeedsFromUrl(originUrl)

  if (!feedResult) return null

  const feeds = Array.isArray(feedResult) ? feedResult : [feedResult]
  const firstFeed = feeds[0]

  if (!firstFeed?.feedUrl) return null

  return {
    name: firstFeed.name || new URL(originUrl).hostname,
    url: firstFeed.url || originUrl,
    feedUrl: firstFeed.feedUrl,
    favicon: typeof firstFeed.favicon === 'string' ? firstFeed.favicon : '',
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const url = body.url?.trim()

  if (!url) {
    return json({ preview: null, feed: null })
  }

  try {
    new URL(url)
  } catch {
    return json({ preview: null, feed: null })
  }

  try {
    // Use createEnrichedPost for unified post creation
    const [postResult, feedResult] = await Promise.allSettled([
      createEnrichedPost(url),
      discoverFeedFromUrl(url),
    ])

    if (postResult.status !== 'fulfilled') {
      return json({ preview: null, feed: null })
    }

    let { post } = postResult.value

    // Transform images for display (handle hotlink-blocked CDNs)
    post = await transformPostImages(post, url)

    // Extract feed for UI (separate from post's feedUrl)
    const feed = feedResult.status === 'fulfilled' ? feedResult.value : null

    return json({ preview: post, feed })
  } catch (e) {
    console.error('Preview error:', e)
    return json({ preview: null, feed: null })
  }
}
