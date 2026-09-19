import type { Feed } from './models/feed'
import type { Post } from './models/post'
import type { RSSFeed, RSSItem } from './models/rss'
import { fetchFeedsFromUrl } from './feed-helpers'
import { fetchFeed } from './parsers/rss'
import { createEnrichedPost, createPost } from './post-helpers'
import { htmlToMarkdown } from './parsers/rss-post'
import { getHumanHostname, normalizeUrl } from './utils/url'
import { timeout } from './utils/timeout'

export interface DiscoveredFeedInfo {
  name: string
  url: string
  feedUrl: string
  favicon: string
  itemCount: number
  /** Detected link aggregator — its posts only look right when enriched. */
  enrich: boolean
}

// A clear majority of off-site links is what makes a feed an aggregator. Needs a few
// items to judge, so a feed that happens to open with one outbound link isn't flagged.
const AGGREGATOR_RATIO = 0.6
const AGGREGATOR_MIN_ITEMS = 3

/**
 * True for feeds like Hacker News or Two Stop Bits, whose items point at other sites:
 * the RSS then carries only the aggregator's own name and icon, so every post renders
 * identically. A normal blog — and YouTube, and Reddit — links to itself and is never
 * flagged.
 */
export function looksLikeLinkAggregator(items: RSSItem[], feedUrl: string): boolean {
  const feedHost = getHumanHostname(feedUrl)
  const linked = items.filter((item) => item.link)
  if (!feedHost || linked.length < AGGREGATOR_MIN_ITEMS) {
    return false
  }
  const offsite = linked.filter((item) => getHumanHostname(item.link) !== feedHost)
  return offsite.length / linked.length >= AGGREGATOR_RATIO
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

export interface EnrichItemsOptions extends DiscoverFeedOptions {
  /** Feed tags to stamp on every post, as convertRSSFeedtoPosts does on the plain path. */
  tags?: string[]
  /**
   * Posts enriched on a previous pass. An item whose link is already among them is
   * reused as-is instead of refetching its page — on a refresh most of a feed's items
   * are unchanged, so this is where nearly all the saving is.
   */
  reuse?: Post[]
}

/**
 * Every post in a discovered feed belongs to that feed, so apply feed-level data
 * (feedUrl) and the RSS item's own thumbnail to each post — independent of whether
 * per-item enrichment succeeded (YouTube rate-limits parallel page fetches).
 */
export function applyDiscoveredFeedDefaults(post: Post, feedUrl: string, item: RSSItem): Post {
  post.feedUrl = post.feedUrl || feedUrl
  if (!post.images?.[0]?.uri) {
    const thumb = item.media?.thumbnail?.[0]?.url?.[0]
    if (thumb) post.images = [{ uri: thumb }]
  }
  return post
}

/** A post built from the RSS item alone — the fallback when enrichment fails. */
function postFromRssItem(item: RSSItem, feed: DiscoveredFeedInfo, tags?: string[]): Post {
  const { post } = createPost({
    url: item.link,
    metadata: {
      title: htmlToMarkdown(item.title || ''),
      description: htmlToMarkdown(item.description || ''),
      icon: feed.favicon,
      image: '',
      name: '',
      siteName: '',
      url: item.link,
      feedUrl: feed.feedUrl,
      feedTitle: feed.name,
      feedLinks: [],
      createdAt: item.created || Date.now(),
      updatedAt: item.created || Date.now(),
      author: '',
    },
    originUrl: feed.url,
    rssItem: item,
    createdAt: item.created,
    feedName: feed.name,
    feedIcon: feed.favicon,
  })
  if (tags?.length) post.tags = tags
  return post
}

/**
 * Fetch each item's own page so the post carries the linked site's title, author and
 * image instead of the feed's. One page fetch per item, in parallel with a per-item
 * timeout; a failed or slow fetch falls back to the RSS item.
 */
export async function enrichRssItems(
  items: RSSItem[],
  feed: DiscoveredFeedInfo,
  options?: EnrichItemsOptions,
): Promise<Post[]> {
  const enrichmentTimeout = options?.enrichmentTimeout ?? 5000
  const tags = options?.tags

  // ponytail: an item whose enrichment failed last time is reused as a fallback post
  // and never retried — acceptable because aggregator items roll off within hours.
  const reusable = new Map(
    (options?.reuse ?? []).filter((post) => post.link).map((post) => [post.link as string, post]),
  )

  const posts = await Promise.all(
    items.map(async (item) => {
      if (!item.link) return null

      const known = reusable.get(item.link)
      if (known) {
        // Tags can have been edited since; everything else about the post still holds.
        if (tags?.length) known.tags = tags
        return known
      }

      if (options?.skipEnrichment) {
        return postFromRssItem(item, feed, tags)
      }

      let enriched: { post: Post; title: string } | null = null
      try {
        enriched = await timeout(
          enrichmentTimeout,
          createEnrichedPost(item.link, {
            rssItem: item,
            createdAt: item.created,
            feedName: feed.name,
            feedIcon: feed.favicon,
            feedOrigin: feed.url,
            skipFeedDiscovery: true,
          }),
        )
      } catch {
        // timeout or error - stays null, will use fallback
      }

      const post = enriched?.post ?? postFromRssItem(item, feed, tags)
      if (enriched && tags?.length) post.tags = tags
      return applyDiscoveredFeedDefaults(post, feed.feedUrl, item)
    }),
  )

  return posts.filter((post): post is Post => post !== null)
}

/**
 * Enriched posts for a feed already followed (no discovery step). This is what the feed
 * page renders when `feed.enrich` is set.
 */
export async function loadEnrichedFeedPosts(
  feed: Feed,
  options?: EnrichItemsOptions,
): Promise<Post[]> {
  const { feed: rssFeed } = await fetchFeed(feed.feedUrl)
  const info: DiscoveredFeedInfo = {
    name: feed.name || rssFeed.title || '',
    url: feed.url || rssFeed.url || '',
    feedUrl: feed.feedUrl,
    favicon: typeof feed.favicon === 'string' ? feed.favicon : '',
    itemCount: rssFeed.items.length,
    enrich: true,
  }
  const items = options?.maxItems ? rssFeed.items.slice(0, options.maxItems) : rssFeed.items
  return enrichRssItems(items, info, { ...options, tags: feed.tags })
}

export async function discoverAndEnrichFeed(
  url: string,
  options?: DiscoverFeedOptions,
): Promise<DiscoveredFeedResult> {
  const normalizedUrl = normalizeUrl(url)

  if (!normalizedUrl) {
    throw new Error('URL is required')
  }

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
    enrich: looksLikeLinkAggregator(rssFeed.items, firstFeed.feedUrl),
  }

  const items = options?.maxItems ? rssFeed.items.slice(0, options.maxItems) : rssFeed.items
  const posts = await enrichRssItems(items, discoveredFeed, options)

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
    enrich: false, // items aren't fetched here, so aggregator detection can't run
  }
}
