import type { RequestHandler } from './$types'
import type { Post } from '@feeds/core'
import { fetchFeedsFromUrl, createEnrichedPost } from '@feeds/core'
import { getFaviconForUrl } from '$lib/imageEmbed'
import { processImage, deleteCachedImage } from '$lib/server/imageProcessing'
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

export const DELETE: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const postId = body.id

  if (!postId) {
    return json({ error: 'Post ID required' }, { status: 400 })
  }

  const filePath = join(process.cwd(), 'static', 'myposts.json')
  const content = await readFile(filePath, 'utf-8')
  const posts: Post[] = JSON.parse(content)

  // Find the post being deleted and extract its cacheHash
  const deletedPost = posts.find((p) => p._id === postId)
  const cacheHash = deletedPost?.images?.[0]?.cacheHash

  // Count references in one pass - if only 1 reference exists, it's the post being deleted
  let refCount = 0
  if (cacheHash) {
    for (const p of posts) {
      if (p.images?.[0]?.cacheHash === cacheHash) {
        refCount++
        if (refCount > 1) break // early exit - no need to delete
      }
    }
  }

  const newPosts = posts.filter((p) => p._id !== postId)
  await writeFile(filePath, JSON.stringify(newPosts, null, 4))

  // Delete cache only if this was the sole reference
  if (cacheHash && refCount === 1) {
    await deleteCachedImage(cacheHash)
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

      await savePost(post)

      return json({ success: true })
    } catch (e) {
      console.error('Add to myfeed error:', e)
      return json({ error: 'Failed to add post' }, { status: 500 })
    }
  }

  return json({ error: 'Invalid request: must provide either url or post' }, { status: 400 })
}
