import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createEnrichedPost, normalizeUrl, discoverFeedFromUrl, transformPostImages, timeout } from '@feeds/core'
import { processImage } from '$lib/server/imageProcessing'

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

    // Cache the primary image server-side so hotlink-blocked CDNs (e.g. pbs.twimg.com)
    // render in the preview. Save reuses the cacheHash, so this work isn't repeated.
    // ponytail: previewing without saving leaves one orphan cached image on disk
    if (post.images?.[0]?.uri && !post.images[0].blurhash) {
      try {
        const result = await timeout(8000, processImage(post.images[0].uri))
        if (result) {
          post.images = [{
            ...post.images[0],
            blurhash: result.blurhash,
            aspectRatio: result.aspectRatio,
            cacheHash: result.cacheHash,
            cacheExt: result.cacheExt,
          }]
        }
      } catch {
        // Image processing timed out or failed - keep the original image.uri
      }
    }

    // Extract feed for UI (separate from post's feedUrl)
    const feed = feedResult.status === 'fulfilled' ? feedResult.value : null

    return json({ preview: post, feed })
  } catch (e) {
    console.error('Preview error:', e)
    return json({ preview: null, feed: null })
  }
}
