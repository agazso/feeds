import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Post } from '@feeds/core'
import { fetchFeedsFromUrl, fetchEnrichedMetadata, buildPostFromMetadata } from '@feeds/core'
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
    const [metadataResult, feedResult] = await Promise.allSettled([
      fetchEnrichedMetadata(url),
      discoverFeedFromUrl(url),
    ])

    // Extract metadata (required)
    if (metadataResult.status !== 'fulfilled') {
      return json({ preview: null, feed: null })
    }
    const { metadata, originUrl } = metadataResult.value

    // Extract feed (optional enhancement)
    const feed = feedResult.status === 'fulfilled' ? feedResult.value : null

    let { post } = buildPostFromMetadata(url, metadata, originUrl)

    // Transform images for display (handle hotlink-blocked CDNs)
    post = await transformPostImages(post, url)

    // Enrich post with feedUrl if discovered
    if (feed) {
      post.feedUrl = feed.feedUrl
    }

    return json({ preview: post, feed })
  } catch (e) {
    console.error('Preview error:', e)
    return json({ preview: null, feed: null })
  }
}
