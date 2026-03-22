import type { Post } from './models/post'
import type { RSSFeed } from './models/rss'
import { fetchFeedsFromUrl } from './feed-helpers'
import { fetchFeed } from './parsers/rss'
import { createEnrichedPost, createPost } from './post-helpers'
import { htmlToMarkdown } from './parsers/rss-post'
import { normalizeUrl } from './utils/url'
import { timeout } from './utils/timeout'

export interface DiscoveredFeedInfo {
  name: string
  url: string
  feedUrl: string
  favicon: string
  itemCount: number
}

export interface DiscoveredFeedResult {
  feed: DiscoveredFeedInfo
  posts: Post[]
}

export interface DiscoverFeedOptions {
  enrichmentTimeout?: number // default: 5000ms
  maxItems?: number
  skipEnrichment?: boolean
}

export async function discoverAndEnrichFeed(
  url: string,
  options?: DiscoverFeedOptions,
): Promise<DiscoveredFeedResult> {
  const normalizedUrl = normalizeUrl(url)

  if (!normalizedUrl) {
    throw new Error('URL is required')
  }

  const enrichmentTimeout = options?.enrichmentTimeout ?? 5000

  // Discover feed from URL
  const feedResult = await fetchFeedsFromUrl(normalizedUrl)

  if (!feedResult) {
    throw new Error('No RSS feed found at this URL')
  }

  // Handle single feed or array of feeds
  const feeds = Array.isArray(feedResult) ? feedResult : [feedResult]
  const firstFeed = feeds[0]

  if (!firstFeed?.feedUrl) {
    throw new Error('Could not discover feed URL')
  }

  // Fetch the actual feed items
  const rssFeedResult = await fetchFeed(firstFeed.feedUrl)
  const rssFeed: RSSFeed = rssFeedResult.feed

  // Prepare feed info
  const discoveredFeed: DiscoveredFeedInfo = {
    name: firstFeed.name || rssFeed.title || 'Unknown Feed',
    url: firstFeed.url || rssFeed.url || normalizedUrl,
    feedUrl: firstFeed.feedUrl,
    favicon: typeof firstFeed.favicon === 'string' ? firstFeed.favicon : '',
    itemCount: rssFeed.items.length,
  }

  // Limit items if maxItems specified
  const itemsToProcess = options?.maxItems
    ? rssFeed.items.slice(0, options.maxItems)
    : rssFeed.items

  // Enrich all items using createEnrichedPost
  const posts: Post[] = (
    await Promise.all(
      itemsToProcess.map(async (item) => {
        if (!item.link) return null

        // Skip enrichment if requested
        if (options?.skipEnrichment) {
          return createPost({
            url: item.link,
            metadata: {
              title: htmlToMarkdown(item.title || ''),
              description: htmlToMarkdown(item.description || ''),
              icon: discoveredFeed.favicon,
              image: '',
              name: '',
              siteName: '',
              url: item.link,
              feedUrl: discoveredFeed.feedUrl,
              feedTitle: discoveredFeed.name,
              feedLinks: [],
              createdAt: item.created || Date.now(),
              updatedAt: item.created || Date.now(),
              author: '',
            },
            originUrl: discoveredFeed.url,
            rssItem: item,
            createdAt: item.created,
            feedName: discoveredFeed.name,
            feedIcon: discoveredFeed.favicon,
          }).post
        }

        let enrichedResult: { post: Post; title: string } | null = null
        try {
          enrichedResult = await timeout(
            enrichmentTimeout,
            createEnrichedPost(item.link, {
              rssItem: item,
              createdAt: item.created,
              feedName: discoveredFeed.name,
              feedIcon: discoveredFeed.favicon,
              feedOrigin: discoveredFeed.url,
              skipFeedDiscovery: true,
            }),
          )
        } catch {
          // timeout or error - stays null, will use fallback
        }

        let post: Post
        if (enrichedResult) {
          post = enrichedResult.post
        } else {
          // Fallback: create post from RSS item only (no enrichment)
          post = createPost({
            url: item.link,
            metadata: {
              title: htmlToMarkdown(item.title || ''),
              description: htmlToMarkdown(item.description || ''),
              icon: discoveredFeed.favicon,
              image: '',
              name: '',
              siteName: '',
              url: item.link,
              feedUrl: discoveredFeed.feedUrl,
              feedTitle: discoveredFeed.name,
              feedLinks: [],
              createdAt: item.created || Date.now(),
              updatedAt: item.created || Date.now(),
              author: '',
            },
            originUrl: discoveredFeed.url,
            rssItem: item,
            createdAt: item.created,
            feedName: discoveredFeed.name,
            feedIcon: discoveredFeed.favicon,
          }).post
        }

        return post
      }),
    )
  ).filter((post): post is Post => post !== null)

  return { feed: discoveredFeed, posts }
}

/**
 * Simple feed discovery that returns basic feed info without fetching items.
 * Useful for getting feed metadata quickly (name, url, favicon).
 */
export async function discoverFeedFromUrl(url: string): Promise<DiscoveredFeedInfo | null> {
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
    itemCount: 0, // Not fetched in simple discovery
  }
}
