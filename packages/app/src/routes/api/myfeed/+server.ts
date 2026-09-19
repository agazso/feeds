import type { RequestHandler } from './$types'
import type { Post } from '@feeds/core'
import { createEnrichedPost, discoverFeedFromUrl, getFaviconForUrl, timeout } from '@feeds/core'
import { processImage, processFavicon, deleteCachedImage } from '$lib/server/imageProcessing'
import { writeFile } from 'fs/promises'
import { json } from '@sveltejs/kit'
import { loadMyfeedPosts, myPostsPath } from '$lib/myfeed'

async function savePost(post: Post, user?: string): Promise<void> {
  const posts = await loadMyfeedPosts(user)
  await writeFile(myPostsPath(user), JSON.stringify([post, ...posts], null, 4))
}

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const body = await request.json()
  const { id, tags } = body

  if (!id) {
    return json({ error: 'Post ID required' }, { status: 400 })
  }

  if (!Array.isArray(tags)) {
    return json({ error: 'Tags must be an array' }, { status: 400 })
  }

  const filePath = myPostsPath(locals.user)
  const posts = await loadMyfeedPosts(locals.user)

  const postIndex = posts.findIndex((p) => p._id === id)
  if (postIndex === -1) {
    return json({ error: 'Post not found' }, { status: 404 })
  }

  posts[postIndex].tags = tags.length > 0 ? tags : undefined
  await writeFile(filePath, JSON.stringify(posts, null, 4))

  return json({ success: true, post: posts[postIndex] })
}

export const DELETE: RequestHandler = async ({ request, locals }) => {
  const body = await request.json()
  const postId = body.id

  if (!postId) {
    return json({ error: 'Post ID required' }, { status: 400 })
  }

  const filePath = myPostsPath(locals.user)
  const posts = await loadMyfeedPosts(locals.user)

  // Find the post being deleted and extract cache hashes
  const deletedPost = posts.find((p) => p._id === postId)
  const imageCacheHash = deletedPost?.images?.[0]?.cacheHash
  const imageCacheExt = deletedPost?.images?.[0]?.cacheExt || 'webp'
  const faviconCacheHash = deletedPost?.author?.image?.cacheHash

  // Count image references - if only 1 reference exists, it's the post being deleted
  let imageRefCount = 0
  if (imageCacheHash) {
    for (const p of posts) {
      if (p.images?.[0]?.cacheHash === imageCacheHash) {
        imageRefCount++
        if (imageRefCount > 1) break // early exit - no need to delete
      }
    }
  }

  // Count favicon references - same pattern
  let faviconRefCount = 0
  if (faviconCacheHash) {
    for (const p of posts) {
      if (p.author?.image?.cacheHash === faviconCacheHash) {
        faviconRefCount++
        if (faviconRefCount > 1) break // early exit - no need to delete
      }
    }
  }

  const newPosts = posts.filter((p) => p._id !== postId)
  await writeFile(filePath, JSON.stringify(newPosts, null, 4))

  // Delete caches only if this was the sole reference
  if (imageCacheHash && imageRefCount === 1) {
    await deleteCachedImage(imageCacheHash, imageCacheExt, locals.user)
  }
  if (faviconCacheHash && faviconRefCount === 1) {
    await deleteCachedImage(faviconCacheHash, 'webp', locals.user)
  }

  return json({ success: true })
}

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const body = await request.json()

  // URL mode: fetch metadata and build post
  if (body.url && typeof body.url === 'string') {
    const postUrl = body.url.trim()
    const tags = Array.isArray(body.tags) ? body.tags : undefined
    
    // Get feedUrl from query parameters if provided (preserves feed context)
    const searchParams = new URL(url).searchParams
    const providedFeedUrl = searchParams.get('feedUrl')

    try {
      new URL(url)
    } catch {
      return json({ error: 'Invalid URL format' }, { status: 400 })
    }

    try {
      const { post, title } = await createEnrichedPost(postUrl)

      // Use provided feedUrl if available (preserves feed context from share page)
      if (providedFeedUrl) {
        post.feedUrl = providedFeedUrl
      } else if (!post.feedUrl && post.link) {
        // Fallback: try to discover feedUrl if not provided
        const feedInfo = await discoverFeedFromUrl(post.link)
        if (feedInfo?.feedUrl) {
          post.feedUrl = feedInfo.feedUrl
        }
      }

      // Apply hardcoded favicons for sites like Reddit and X
      const hardcodedFavicon = getFaviconForUrl(postUrl)
      if (hardcodedFavicon) {
        post.author = {
          ...post.author,
          name: post.author?.name || '',
          uri: post.author?.uri || '',
          image: { uri: hardcodedFavicon }
        }
      } else if (!post.author?.image?.uri) {
        const feedInfo = await discoverFeedFromUrl(postUrl)
        if (feedInfo?.favicon) {
          post.author = {
            ...post.author,
            name: post.author?.name || '',
            uri: post.author?.uri || '',
            image: { uri: feedInfo.favicon }
          }
        }
      }

      if (tags && tags.length > 0) {
        post.tags = tags
      }

      // Process primary image: generate blurhash and cache
      if (post.images?.[0]?.uri && !post.images[0].blurhash) {
        const result = await processImage(post.images[0].uri, locals.user)
        if (result) {
          post.images = [{
            ...post.images[0],
            blurhash: result.blurhash,
            aspectRatio: result.aspectRatio,
            cacheHash: result.cacheHash,
            cacheExt: result.cacheExt,
          }]
        }
      }

      // Process favicon: cache as WebP (skip data URIs)
      if (post.author?.image?.uri && !post.author.image.uri.startsWith('data:')) {
        const result = await processFavicon(post.author.image.uri, locals.user)
        if (result) {
          post.author.image.cacheHash = result.cacheHash
        }
      }

      await savePost(post, locals.user)

      return json({
        success: true,
        post: {
          title: title || post.author?.name || 'Shared link',
          icon: getFaviconForUrl(postUrl, post.author?.image?.uri),
        },
      })
    } catch (e) {
      console.error('Add to myfeed error:', e)
      return json({ error: 'Failed to fetch URL metadata' }, { status: 500 })
    }
  }

  // Post mode: add existing post directly
  if (body.post && typeof body.post === 'object') {
    try {
      const post = body.post as Post
      const tags = Array.isArray(body.tags) ? body.tags : undefined

      // Get feedUrl from query parameters if provided (preserves feed context)
      const searchParams = new URL(url).searchParams
      const providedFeedUrl = searchParams.get('feedUrl')

      // Use provided feedUrl if available. No discovery fallback: this post comes from
      // /api/preview, which already discovered (or failed to discover) the feed. Retrying
      // here refetched the whole page — 1.8s on a link like shazam.com, which serves 1.5 MB
      // of HTML per request.
      if (providedFeedUrl) {
        post.feedUrl = providedFeedUrl
      }

      // Generate new ID to avoid duplicates
      post._id = `${post.link || 'post'}-${Math.random().toString(36).slice(2, 8)}`
      post.createdAt = Date.now()

      if (tags && tags.length > 0) {
        post.tags = tags
      }

      // Process primary image: generate blurhash and cache.
      // Wrapped in a timeout so a slow image host can't stall Save; on timeout we
      // persist the post with its existing image.uri (no blurhash/cache).
      if (post.images?.[0]?.uri && !post.images[0].blurhash) {
        try {
          const result = await timeout(8000, processImage(post.images[0].uri, locals.user))
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

      // Process favicon: cache as WebP (skip data URIs and anything preview already cached)
      if (
        post.author?.image?.uri &&
        !post.author.image.uri.startsWith('data:') &&
        !post.author.image.cacheHash
      ) {
        try {
          const result = await timeout(8000, processFavicon(post.author.image.uri, locals.user))
          if (result) {
            post.author.image.cacheHash = result.cacheHash
          }
        } catch {
          // Favicon processing timed out or failed - keep the original favicon uri
        }
      }

      await savePost(post, locals.user)

      return json({
        success: true,
        post: {
          title: post.author?.name || 'Shared link',
          icon: getFaviconForUrl(post.link || '', post.author?.image?.uri),
        },
      })
    } catch (e) {
      console.error('Add to myfeed error:', e)
      return json({ error: 'Failed to add post' }, { status: 500 })
    }
  }

  return json({ error: 'Invalid request: must provide either url or post' }, { status: 400 })
}
