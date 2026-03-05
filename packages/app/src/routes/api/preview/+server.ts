import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Post, Feed } from '@feeds/core'
import { fetchHtmlMetaDataOnly, fetchFeedsFromUrl, type HtmlMetaData } from '@feeds/core'

interface DiscoveredFeed {
  name: string
  url: string
  feedUrl: string
  favicon: string
}

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

function buildPostFromMetadata(url: string, metadata: HtmlMetaData, originUrl: string): Post {
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

  return {
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
      fetchMetadataForUrl(url),
      discoverFeedFromUrl(url),
    ])

    // Extract metadata (required)
    if (metadataResult.status !== 'fulfilled') {
      return json({ preview: null, feed: null })
    }
    const { metadata, originUrl } = metadataResult.value

    // Extract feed (optional enhancement)
    const feed = feedResult.status === 'fulfilled' ? feedResult.value : null

    const post = buildPostFromMetadata(url, metadata, originUrl)

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
