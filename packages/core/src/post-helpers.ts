import type { Author } from './models/author'
import type { Post } from './models/post'
import type { RSSItem } from './models/rss'
import { fetchFeedsFromUrl } from './feed-helpers'
import { type HtmlMetaData, fetchHtmlMetaDataOnly } from './parsers/html-metadata'
import {
  isRedditPostUrl,
  fetchRedditPostMetadata,
  makeCanonicalRedditLink,
  toOldRedditUrl,
  stripRedditPostChrome,
} from './providers/reddit'
import { isYoutubeLink } from './providers/youtube'
import { fetchShazamSongMetadata } from './providers/shazam'
import { createUrlFromUrn, isImageUrl } from './utils/url'
import { HEADERS_WITH_BOT } from './utils/headers'
import { htmlToMarkdown } from './parsers/rss-post'

/**
 * Extract author-specific path for multi-author sites.
 * Returns the author's main page URL if a pattern matches.
 *
 * Supported patterns:
 * - /sites/{author}/... (Forbes, etc.)
 * - /@{author}/... (Medium, Substack usernames)
 * - /authors/{author}/... (various blogs)
 */
function extractAuthorPath(url: string): string | null {
  const parsedUrl = new URL(url)
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean)

  // Pattern: /sites/{author}/...
  if (pathParts[0] === 'sites' && pathParts.length > 1) {
    return `${parsedUrl.origin}/sites/${pathParts[1]}/`
  }

  // Pattern: /@{author}/...
  if (pathParts[0]?.startsWith('@') && pathParts.length > 1) {
    return `${parsedUrl.origin}/${pathParts[0]}/`
  }

  // Pattern: /authors/{author}/...
  if (pathParts[0] === 'authors' && pathParts.length > 1) {
    return `${parsedUrl.origin}/authors/${pathParts[1]}/`
  }

  return null
}

export function formatAuthorName(name?: string, author?: string, fallback?: string): string {
  if (name && author && name !== author) {
    return `${name} | ${author}`
  }
  return name || author || fallback || ''
}

/**
 * Check if two URLs have the same hostname (ignoring www prefix).
 */
function isSameHost(url1: string, url2: string): boolean {
  try {
    const host1 = new URL(url1).hostname.replace(/^www\./, '')
    const host2 = new URL(url2).hostname.replace(/^www\./, '')
    return host1 === host2
  } catch {
    return false
  }
}

/**
 * Format a hostname for display (remove www, capitalize first letter).
 */
function formatHostname(hostname: string): string {
  const clean = hostname.replace(/^www\./, '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/**
 * Determines whether to use feedName over siteIdentity for author attribution.
 *
 * YouTube URLs should use feedName (channel name) only when the origin is also YouTube.
 * This handles YouTube channel feeds while avoiding misattribution when aggregators
 * (like Hacker News) link to YouTube videos.
 */
function shouldUseFeedName(
  feedName: string | undefined,
  siteIdentity: string | undefined,
  articleUrl: string,
  originUrl: string,
): boolean {
  if (!feedName || feedName === siteIdentity) return false

  // YouTube: use feedName (channel name) only when origin is also YouTube
  // This handles YouTube channel feeds while avoiding aggregator misattribution
  if (isYoutubeLink(articleUrl)) {
    return isYoutubeLink(originUrl)
  }

  return false
}

export interface CreatePostParams {
  url: string
  metadata: HtmlMetaData
  originUrl: string
  feedName?: string // Fallback for author name
  feedUrl?: string // RSS feed URL
  feedIcon?: string // Fallback for author icon (from feed discovery)
  rssItem?: RSSItem // Original RSS item (for /discover)
  createdAt?: number // From RSS item or Date.now()
}

// Generic titles that indicate metadata fetch failed to get real content
const GENERIC_TITLES = ['reddit - the heart of the internet']

function isGenericTitle(title: string | undefined): boolean {
  if (!title) return true
  return GENERIC_TITLES.includes(title.toLowerCase().trim())
}

function extractRssItemImage(rssItem: RSSItem | undefined): string | undefined {
  const thumbnail = rssItem?.media?.thumbnail?.[0]
  return thumbnail?.url?.[0]
}

export function createPost(params: CreatePostParams): { post: Post; title: string } {
  const { url, metadata, originUrl, feedName, feedUrl, feedIcon, rssItem, createdAt } = params

  // Prefer RSS item title when metadata has generic/missing title (e.g., Reddit)
  const useRssItemData = isGenericTitle(metadata.title) && rssItem?.title
  let title = useRssItemData ? htmlToMarkdown(rssItem.title || '') : (metadata.title?.trim() || '')
  let description = useRssItemData ? (rssItem.description || '') : (metadata.description?.trim() || '')
  // For Reddit: prefer RSS item image (from media.thumbnail), fall back to metadata
  let image = useRssItemData ? (extractRssItemImage(rssItem) || metadata.image) : metadata.image

  if (isImageUrl(url)) {
    image = url
    title = ''
    description = ''
  }

  const siteIdentity = metadata.name || metadata.siteName
  // Use feedName for YouTube (channel name) when origin is also YouTube,
  // otherwise use article's siteIdentity (feedName only for same-host posts)
  const authorIdentity = shouldUseFeedName(feedName, siteIdentity, url, originUrl)
    ? feedName
    : siteIdentity || (isSameHost(url, originUrl) ? feedName : undefined)

  let text =
    siteIdentity && title
      ? `**${title}**\n\n${description}`
      : title && description
        ? `**${title}**\n\n${description}`
        : description || title || ''

  // Add comments link if available (e.g., from Hacker News)
  if (rssItem?.comments) {
    text = `${text}\n\n[Comments](${rssItem.comments})`
  }

  const post: Post = {
    _id: `${url}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: createdAt || Date.now(),
    images: image ? [{ uri: image }] : [],
    link: url,
    author: {
      name: formatAuthorName(authorIdentity, metadata.author, formatHostname(new URL(url).hostname)),
      uri: originUrl,
      image: { uri: useRssItemData ? (feedIcon || metadata.icon) : (metadata.icon || feedIcon) },
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
    // Only use explicit identity fields, NOT title (title is not identity)
    name: urlMeta.name || originMeta.name || originMeta.siteName,
    siteName: urlMeta.siteName || originMeta.siteName,
    author: urlMeta.author || originMeta.author,
    icon: urlMeta.icon || originMeta.icon,
    // Use origin's feedUrl if article page didn't have one
    feedUrl: urlMeta.feedUrl || originMeta.feedUrl,
  }
}

/**
 * Check if metadata has useful identity info (name, siteName, or author).
 * Used to filter out blocked/captcha pages that only return a title.
 */
function hasIdentityData(meta: HtmlMetaData): boolean {
  return !!(meta.name || meta.siteName || meta.author)
}

export async function fetchEnrichedMetadata(
  url: string,
  init?: RequestInit,
): Promise<{ metadata: HtmlMetaData; originUrl: string }> {
  const parsedUrl = new URL(url)
  const originUrl = parsedUrl.origin

  // Handle Reddit post/comment URLs specially - use Reddit JSON API for rich metadata
  if (isRedditPostUrl(url)) {
    const redditMeta = await fetchRedditPostMetadata(url)
    if (redditMeta) {
      const metadata: HtmlMetaData = {
        title: redditMeta.title,
        description: redditMeta.description,
        image: redditMeta.image || '',
        url,
        name: `r/${redditMeta.subreddit}`,
        siteName: 'Reddit',
        author: redditMeta.author,
        icon: '', // Favicon will be handled by transformPostImages()
        feedUrl: '',
        feedTitle: '',
        feedLinks: [],
        createdAt: redditMeta.createdAt,
        updatedAt: redditMeta.createdAt,
      }
      return { metadata, originUrl }
    }

    // JSON API failed (it needs OAuth now → 403). old.reddit.com serves real og: tags
    // to bots without the www "please verify" interstitial that the default (FELFELE)
    // UA triggers. Parse it with the existing HTML metadata parser.
    try {
      const meta = await fetchHtmlMetaDataOnly(toOldRedditUrl(url), { headers: HEADERS_WITH_BOT })
      const subreddit = makeCanonicalRedditLink(url)?.subreddit
      return {
        metadata: {
          ...meta,
          name: subreddit ? `r/${subreddit}` : meta.name,
          siteName: 'Reddit',
          // Strip Reddit's "Posted in r/X by u/Y • N points and M comments" chrome
          description: stripRedditPostChrome(meta.description),
          // Drop Reddit's generic placeholder image so text posts don't get an icon hero
          image: /redditstatic\.com/.test(meta.image) ? '' : meta.image,
          icon: '', // Favicon will be handled by transformPostImages()
        },
        originUrl,
      }
    } catch {
      // Fall through to generic fetching if old.reddit also fails
    }
  }

  // Shazam blocks server-side fetches (405); its song pages are served from the iTunes API
  const shazamMeta = await fetchShazamSongMetadata(url)
  if (shazamMeta) {
    return {
      metadata: {
        title: shazamMeta.title,
        description: shazamMeta.description,
        image: shazamMeta.image,
        url,
        name: shazamMeta.artist,
        siteName: 'Shazam',
        author: '',
        icon: '', // Favicon will be handled by transformPostImages()
        feedUrl: '',
        feedTitle: '',
        feedLinks: [],
        createdAt: 0,
        updatedAt: 0,
      },
      originUrl,
    }
  }

  const urlMetadata = await fetchHtmlMetaDataOnly(url, init)

  const isSubpage = parsedUrl.pathname !== '/'
  const missingIdentity = !urlMetadata.name && !urlMetadata.siteName && !urlMetadata.author
  // Also check for missing content (captcha pages have no title/description)
  const missingContent = !urlMetadata.title || !urlMetadata.description

  let originMetadata: HtmlMetaData | null = null

  // Try author path first for multi-author sites
  if (isSubpage && (missingIdentity || missingContent)) {
    const authorPath = extractAuthorPath(url)
    if (authorPath) {
      try {
        originMetadata = await fetchHtmlMetaDataOnly(authorPath, init)
      } catch {
        // Author path fetch failed, continue
      }
    }
  }

  // Fallback: try origin if author path didn't work
  if (!originMetadata && isSubpage && missingIdentity) {
    try {
      originMetadata = await fetchHtmlMetaDataOnly(`${originUrl}/`, init)
    } catch {
      // Origin fetch failed, continue without it
    }
  }

  // Only use origin metadata if it has useful identity data
  // (filters out captcha/blocked pages that only return a title)
  if (originMetadata && !hasIdentityData(originMetadata)) {
    originMetadata = null
  }

  let metadata = originMetadata ? mergeHtmlMetadata(urlMetadata, originMetadata) : urlMetadata

  // Try manifest if still missing name
  if (!metadata.name && !metadata.siteName) {
    metadata = await enrichFromManifest(metadata, originUrl, init)
  }

  // YouTube channel name + feed URL are extracted from the watch page itself
  // (parseHtmlMetaData), so no extra requests to YouTube are needed here.

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
  feedIcon?: string // Fallback author icon (from feed discovery)
  feedOrigin?: string // Feed's origin URL (for aggregator detection)
  createdAt?: number // From RSS item timestamp
  skipFeedDiscovery?: boolean // Skip feed URL discovery (for preview/discover mode)
}

export async function createEnrichedPost(
  url: string,
  options?: CreateEnrichedPostOptions,
): Promise<{ post: Post; title: string }> {
  // 1. Fetch enriched metadata
  const { metadata, originUrl } = await fetchEnrichedMetadata(url)

  // 2. Use provided feedUrl, or discover from metadata, or probe origin
  let feedUrl: string | undefined = options?.feedUrl || metadata.feedUrl
  if (!feedUrl && !options?.skipFeedDiscovery) {
    feedUrl = await discoverFeedUrl(originUrl)
  }

  // 3. Create post with all data
  // Use feedOrigin for author attribution (distinguishes external articles from same-host posts)
  return createPost({
    url,
    metadata,
    originUrl: options?.feedOrigin || originUrl,
    feedUrl,
    feedIcon: options?.feedIcon,
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
