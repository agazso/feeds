import type { Author } from './models/author'
import type { Post } from './models/post'
import type { RSSItem } from './models/rss'
import { fetchFeedsFromUrl } from './feed-helpers'
import { type HtmlMetaData, fetchHtmlMetaDataOnly } from './parsers/html-metadata'
import { createUrlFromUrn, isImageUrl } from './utils/url'

export function formatAuthorName(name?: string, author?: string, fallback?: string): string {
  if (name && author) {
    return `${name} | ${author}`
  }
  return name || author || fallback || ''
}

export interface CreatePostParams {
  url: string
  metadata: HtmlMetaData
  originUrl: string
  feedName?: string // Fallback for author name
  feedUrl?: string // RSS feed URL
  rssItem?: RSSItem // Original RSS item (for /discover)
  createdAt?: number // From RSS item or Date.now()
}

export function createPost(params: CreatePostParams): { post: Post; title: string } {
  const { url, metadata, originUrl, feedName, feedUrl, rssItem, createdAt } = params

  let title = metadata.title?.trim() || ''
  let description = metadata.description?.trim() || ''
  let image = metadata.image

  if (isImageUrl(url)) {
    image = url
    title = ''
    description = ''
  }

  const siteIdentity = metadata.name || metadata.siteName

  const text =
    siteIdentity && title
      ? `**${title}**\n\n${description}`
      : title && description
        ? `**${title}**\n\n${description}`
        : description || title || ''

  const post: Post = {
    _id: `${url}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: createdAt || Date.now(),
    images: image ? [{ uri: image }] : [],
    link: url,
    author: {
      name: formatAuthorName(siteIdentity, metadata.author, feedName || new URL(url).hostname),
      uri: originUrl,
      image: { uri: metadata.icon },
    },
    rssItem,
    feedUrl,
  }

  return { post, title }
}

export function mergeHtmlMetadata(
  urlMeta: HtmlMetaData,
  originMeta: HtmlMetaData,
): HtmlMetaData {
  return {
    ...urlMeta,
    // Use origin's name/siteName/title as fallback for name
    name: urlMeta.name || originMeta.name || originMeta.siteName || originMeta.title,
    siteName: urlMeta.siteName || originMeta.siteName,
    author: urlMeta.author || originMeta.author,
    icon: urlMeta.icon || originMeta.icon,
  }
}

/** @deprecated Use createPost or createEnrichedPost instead */
export function buildPostFromMetadata(
  url: string,
  metadata: HtmlMetaData,
  originUrl: string,
): { post: Post; title: string } {
  return createPost({ url, metadata, originUrl })
}

export async function fetchEnrichedMetadata(
  url: string,
  init?: RequestInit,
): Promise<{ metadata: HtmlMetaData; originUrl: string }> {
  const urlMetadata = await fetchHtmlMetaDataOnly(url, init)

  const parsedUrl = new URL(url)
  const originUrl = parsedUrl.origin
  const isSubpage = parsedUrl.pathname !== '/'
  const missingIdentity = !urlMetadata.name && !urlMetadata.siteName && !urlMetadata.author

  let originMetadata: HtmlMetaData | null = null
  if (isSubpage && missingIdentity) {
    try {
      originMetadata = await fetchHtmlMetaDataOnly(`${originUrl}/`, init)
    } catch {
      // Origin fetch failed, continue without it
    }
  }

  let metadata = originMetadata ? mergeHtmlMetadata(urlMetadata, originMetadata) : urlMetadata

  // Try manifest if still missing name
  if (!metadata.name && !metadata.siteName) {
    metadata = await enrichFromManifest(metadata, originUrl, init)
  }

  return { metadata, originUrl }
}

async function enrichFromManifest(
  metadata: HtmlMetaData,
  originUrl: string,
  init?: RequestInit,
): Promise<HtmlMetaData> {
  // Try common manifest paths
  const manifestPaths = ['/manifest.json', '/site.webmanifest', '/manifest.webmanifest']

  for (const path of manifestPaths) {
    try {
      const response = await fetch(`${originUrl}${path}`, init)
      if (!response.ok) continue

      const manifest = (await response.json()) as {
        name?: string
        short_name?: string
        icons?: { src: string }[]
      }
      const manifestName = manifest.short_name || manifest.name
      if (manifestName) {
        return {
          ...metadata,
          name: metadata.name || manifestName,
          siteName: metadata.siteName || manifestName,
          icon:
            metadata.icon ||
            (manifest.icons?.[0]?.src
              ? createUrlFromUrn(manifest.icons[0].src, originUrl)
              : metadata.icon),
        }
      }
    } catch {
      // Manifest fetch failed, try next
    }
  }

  return metadata
}

export interface CreateEnrichedPostOptions {
  rssItem?: RSSItem // For /discover - include original RSS item
  feedName?: string // Fallback author name (e.g., from RSS feed title)
  feedUrl?: string // If known, skip feed URL discovery
  createdAt?: number // From RSS item timestamp
}

export async function createEnrichedPost(
  url: string,
  options?: CreateEnrichedPostOptions,
): Promise<{ post: Post; title: string }> {
  // 1. Fetch enriched metadata
  const { metadata, originUrl } = await fetchEnrichedMetadata(url)

  // 2. Use provided feedUrl, or discover from metadata, or probe origin
  let feedUrl: string | undefined = options?.feedUrl || metadata.feedUrl
  if (!feedUrl) {
    feedUrl = await discoverFeedUrl(originUrl)
  }

  // 3. Create post with all data
  return createPost({
    url,
    metadata,
    originUrl,
    feedUrl,
    rssItem: options?.rssItem,
    feedName: options?.feedName,
    createdAt: options?.createdAt,
  })
}

// Helper to discover feed URL from origin
async function discoverFeedUrl(originUrl: string): Promise<string | undefined> {
  try {
    const result = await fetchFeedsFromUrl(originUrl)
    if (result) {
      const feed = Array.isArray(result) ? result[0] : result
      return feed?.feedUrl
    }
  } catch {
    // Feed discovery failed
  }
  return undefined
}

export function mergeUpdatedPosts(updatedPosts: Post[], oldPosts: Post[]): Post[] {
  const uniqueAuthors = new Map<string, Author>()
  updatedPosts.forEach((post) => {
    if (post.author != null) {
      if (!uniqueAuthors.has(post.author.uri)) {
        uniqueAuthors.set(post.author.uri, post.author)
      }
    }
  })
  const notUpdatedPosts = oldPosts.filter(
    (post) => post.author != null && !uniqueAuthors.has(post.author.uri),
  )
  const allPosts = notUpdatedPosts.concat(updatedPosts)
  const sortedPosts = allPosts.sort((a, b) => b.createdAt - a.createdAt)
  const startId = Date.now()
  const posts = sortedPosts.map((post, index) => ({
    ...post,
    _id: post._id ? post._id : startId + index,
  }))
  return posts
}
