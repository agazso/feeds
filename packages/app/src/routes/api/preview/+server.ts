import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createEnrichedPost, normalizeUrl, discoverFeedFromUrl, transformPostImages, timeout } from '@feeds/core'
import { processImage, processFavicon } from '$lib/server/imageProcessing'

export const POST: RequestHandler = async ({ request, locals }) => {
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

    // Cache the primary image and the favicon server-side so hotlink-blocked CDNs
    // (e.g. pbs.twimg.com) render in the preview — and so Save, which gets this post
    // back, has no network work left to do.
    // ponytail: previewing without saving leaves one orphan cached image on disk
    const faviconUri = post.author?.image?.uri
    const [imageResult, faviconResult] = await Promise.all([
      post.images?.[0]?.uri && !post.images[0].blurhash
        ? timeout(8000, processImage(post.images[0].uri, locals.user)).catch(() => undefined)
        : undefined,
      faviconUri && !faviconUri.startsWith('data:')
        ? timeout(8000, processFavicon(faviconUri, locals.user)).catch(() => undefined)
        : undefined,
    ])

    if (imageResult) {
      post.images = [{
        ...post.images[0],
        blurhash: imageResult.blurhash,
        aspectRatio: imageResult.aspectRatio,
        cacheHash: imageResult.cacheHash,
        cacheExt: imageResult.cacheExt,
      }]
    }
    if (faviconResult && post.author?.image) {
      post.author.image.cacheHash = faviconResult.cacheHash
    }

    // Extract feed for UI (separate from post's feedUrl)
    const feed = feedResult.status === 'fulfilled' ? feedResult.value : null

    // Carry the discovered feed into the post so Save doesn't have to rediscover it.
    if (!post.feedUrl && feed?.feedUrl) {
      post.feedUrl = feed.feedUrl
    }

    return json({ preview: post, feed })
  } catch (e) {
    console.error('Preview error:', e)
    return json({ preview: null, feed: null })
  }
}
