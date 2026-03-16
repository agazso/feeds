import type { RequestHandler } from './$types'
import type { Post } from '@feeds/core'
import { fetchFeedsFromUrl, createEnrichedPost } from '@feeds/core'
import { getFaviconForUrl } from '$lib/imageEmbed'
import { processImage, processFavicon, deleteCachedImage } from '$lib/server/imageProcessing'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { json } from '@sveltejs/kit'

async function discoverFeedUrl(url: string): Promise<string | undefined> {
  try {
    const originUrl = new URL(url).origin
    const result = await fetchFeedsFromUrl(originUrl)
    if (result) {
      const feed = Array.isArray(result) ? result[0] : result
      return feed?.feedUrl
    }
  } catch {
    // Feed discovery failed, continue without feedUrl
  }
  return undefined
}

async function savePost(post: Post): Promise<void> {
  const filePath = join(process.cwd(), 'static', 'myposts.json')
  const content = await readFile(filePath, 'utf-8')
  const posts: Post[] = JSON.parse(content)
  const newPosts = [post, ...posts]
  await writeFile(filePath, JSON.stringify(newPosts, null, 4))
}

export const PATCH: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const { id, tags } = body

  if (!id) {
    return json({ error: 'Post ID required' }, { status: 400 })
  }

  if (!Array.isArray(tags)) {
    return json({ error: 'Tags must be an array' }, { status: 400 })
  }

  const filePath = join(process.cwd(), 'static', 'myposts.json')
  const content = await readFile(filePath, 'utf-8')
  const posts: Post[] = JSON.parse(content)

  const postIndex = posts.findIndex((p) => p._id === id)
  if (postIndex === -1) {
    return json({ error: 'Post not found' }, { status: 404 })
  }

  posts[postIndex].tags = tags.length > 0 ? tags : undefined
  await writeFile(filePath, JSON.stringify(posts, null, 4))

  return json({ success: true, post: posts[postIndex] })
}

export const DELETE: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const postId = body.id

  if (!postId) {
    return json({ error: 'Post ID required' }, { status: 400 })
  }

  const filePath = join(process.cwd(), 'static', 'myposts.json')
  const content = await readFile(filePath, 'utf-8')
  const posts: Post[] = JSON.parse(content)

  // Find the post being deleted and extract cache hashes
  const deletedPost = posts.find((p) => p._id === postId)
  const imageCacheHash = deletedPost?.images?.[0]?.cacheHash
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
    await deleteCachedImage(imageCacheHash)
  }
  if (faviconCacheHash && faviconRefCount === 1) {
    await deleteCachedImage(faviconCacheHash)
  }

  return json({ success: true })
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()

  // URL mode: fetch metadata and build post
  if (body.url && typeof body.url === 'string') {
    const url = body.url.trim()
    const tags = Array.isArray(body.tags) ? body.tags : undefined

    try {
      new URL(url)
    } catch {
      return json({ error: 'Invalid URL format' }, { status: 400 })
    }

    try {
      const { post, title } = await createEnrichedPost(url)

      // Use feed favicon as fallback if page favicon is missing
      if (!post.author?.image?.uri) {
        try {
          const originUrl = new URL(url).origin
          const result = await fetchFeedsFromUrl(originUrl)
          if (result) {
            const feed = Array.isArray(result) ? result[0] : result
            if (feed?.favicon && typeof feed.favicon === 'string') {
              post.author = {
                ...post.author,
                name: post.author?.name || '',
                uri: post.author?.uri || '',
                image: { uri: feed.favicon }
              }
            }
          }
        } catch {
          // Feed discovery failed, continue without fallback
        }
      }

      if (tags && tags.length > 0) {
        post.tags = tags
      }

      // Process primary image: generate blurhash and cache as WebP
      if (post.images?.[0]?.uri && !post.images[0].blurhash) {
        const result = await processImage(post.images[0].uri)
        if (result) {
          post.images = [{
            ...post.images[0],
            blurhash: result.blurhash,
            aspectRatio: result.aspectRatio,
            cacheHash: result.cacheHash,
          }]
        }
      }

      // Process favicon: cache as WebP (skip data URIs)
      if (post.author?.image?.uri && !post.author.image.uri.startsWith('data:')) {
        const result = await processFavicon(post.author.image.uri)
        if (result) {
          post.author.image.cacheHash = result.cacheHash
        }
      }

      await savePost(post)

      return json({
        success: true,
        post: {
          title: title || post.author?.name || 'Shared link',
          icon: getFaviconForUrl(url, post.author?.image?.uri),
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

      // If no feedUrl, try to discover one
      if (!post.feedUrl && post.link) {
        const feedUrl = await discoverFeedUrl(post.link)
        if (feedUrl) {
          post.feedUrl = feedUrl
        }
      }

      // Generate new ID to avoid duplicates
      post._id = `${post.link || 'post'}-${Math.random().toString(36).slice(2, 8)}`
      post.createdAt = Date.now()

      // Process primary image: generate blurhash and cache as WebP
      if (post.images?.[0]?.uri && !post.images[0].blurhash) {
        const result = await processImage(post.images[0].uri)
        if (result) {
          post.images = [{
            ...post.images[0],
            blurhash: result.blurhash,
            aspectRatio: result.aspectRatio,
            cacheHash: result.cacheHash,
          }]
        }
      }

      // Process favicon: cache as WebP (skip data URIs)
      if (post.author?.image?.uri && !post.author.image.uri.startsWith('data:')) {
        const result = await processFavicon(post.author.image.uri)
        if (result) {
          post.author.image.cacheHash = result.cacheHash
        }
      }

      await savePost(post)

      return json({ success: true })
    } catch (e) {
      console.error('Add to myfeed error:', e)
      return json({ error: 'Failed to add post' }, { status: 500 })
    }
  }

  return json({ error: 'Invalid request: must provide either url or post' }, { status: 400 })
}
