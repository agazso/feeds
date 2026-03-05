import type { RequestHandler } from './$types'
import type { Post } from '@feeds/core'
import { fetchHtmlMetaDataOnly, fetchFeedsFromUrl, type HtmlMetaData } from '@feeds/core'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { json } from '@sveltejs/kit'

function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
  const lowercaseUrl = url.toLowerCase()
  return imageExtensions.some((ext) => lowercaseUrl.includes(ext))
}

function mergeMetadata(urlMeta: HtmlMetaData, originMeta: HtmlMetaData): HtmlMetaData {
  return {
    ...urlMeta,
    name: urlMeta.name || originMeta.name,
    icon: urlMeta.icon || originMeta.icon,
  }
}

function buildPostFromMetadata(
  url: string,
  metadata: HtmlMetaData,
  originUrl: string,
): { post: Post; title: string } {
  let title = metadata.title?.trim() || ''
  let description = metadata.description?.trim() || ''
  let image = metadata.image

  if (isImageUrl(url)) {
    image = url
    title = ''
    description = ''
  }

  const text =
    metadata.name && title ? `**${title}**\n\n${description}` : description || title || ''

  const post: Post = {
    _id: `${url}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: Date.now(),
    images: image ? [{ uri: image }] : [],
    link: url,
    author: {
      name: metadata.name || title || new URL(url).hostname,
      uri: originUrl,
      image: { uri: metadata.icon },
    },
  }

  return { post, title }
}

async function fetchMetadataForUrl(
  url: string,
): Promise<{ metadata: HtmlMetaData; originUrl: string }> {
  const urlMetadata = await fetchHtmlMetaDataOnly(url)

  const originUrl = new URL(url).origin
  let originMetadata: HtmlMetaData | null = null
  if (originUrl !== url) {
    try {
      originMetadata = await fetchHtmlMetaDataOnly(originUrl)
    } catch {
      // Origin fetch failed, continue without it
    }
  }

  const metadata = originMetadata ? mergeMetadata(urlMetadata, originMetadata) : urlMetadata

  return { metadata, originUrl }
}

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

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()

  // URL mode: fetch metadata and build post
  if (body.url && typeof body.url === 'string') {
    const url = body.url.trim()

    try {
      new URL(url)
    } catch {
      return json({ error: 'Invalid URL format' }, { status: 400 })
    }

    try {
      const { metadata, originUrl } = await fetchMetadataForUrl(url)
      const { post, title } = buildPostFromMetadata(url, metadata, originUrl)

      // Discover feed URL for the origin
      const feedUrl = await discoverFeedUrl(url)
      if (feedUrl) {
        post.feedUrl = feedUrl
      }

      await savePost(post)

      return json({
        success: true,
        post: {
          title: title || metadata.name || 'Shared link',
          icon: metadata.icon,
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

      await savePost(post)

      return json({ success: true })
    } catch (e) {
      console.error('Add to myfeed error:', e)
      return json({ error: 'Failed to add post' }, { status: 500 })
    }
  }

  return json({ error: 'Invalid request: must provide either url or post' }, { status: 400 })
}
