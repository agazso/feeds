import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createEnrichedPost, normalizeUrl, discoverFeedFromUrl, transformPostImages } from '@feeds/core'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const url = normalizeUrl(body.url)

  if (!url) {
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
