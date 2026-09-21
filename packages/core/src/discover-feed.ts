import { fetchFeedsFromUrl } from './feed-helpers'
import type { Feed } from './models/feed'
import type { Post } from './models/post'
import type { RSSFeed, RSSItem } from './models/rss'
import { fetchFeed } from './parsers/rss'
import { htmlToMarkdown } from './parsers/rss-post'
import { createEnrichedPost, createPost } from './post-helpers'
import { timeout } from './utils/timeout'
import { getHumanHostname, normalizeUrl } from './utils/url'

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

  // Only well-enriched posts are reused. A page that was slow or blocked still yields a
  // post, just one wearing the feed's own icon and carrying no body — and reuse would
  // pin that in place for as long as the item stays in the feed. Retrying them costs a
  // fetch per refresh and lets a bad window heal itself.
  const isEnriched = (post: Post) =>
    !!post.link && (!feed.favicon || post.author?.image?.uri !== feed.favicon)
  const reusable = new Map(
    (options?.reuse ?? []).filter(isEnriched).map((post) => [post.link as string, post]),
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

      let enriched: { post: Post; title: string } | null = null
      if (!options?.skipEnrichment) {
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
      }

      const post = enriched?.post ?? postFromRssItem(item, feed, tags)
      if (enriched && tags?.length) post.tags = tags
      // Credit the aggregator only where the post no longer says so itself: the item
      // came from another site (not a self-post) and the author on display isn't the
      // feed. Enriched posts show the linked site; so do most fallback posts, whose
      // author createPost derives from the link's hostname.
      if (
        getHumanHostname(item.link) !== getHumanHostname(feed.feedUrl) &&
        post.author?.name !== feed.name
      ) {
        // The aggregator's page for *this* item (its discussion thread) when the feed
        // gives one, so the credit links where the post was submitted, not just home.
        post.via = {
          name: feed.name,
          url: item.comments || feed.url,
          icon: feed.favicon || undefined,
        }
      }
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

/**
 * A URL names either one feed or a subscription list (an OPML file) naming many.
 * Collapsing a list to its first feed, as taking `feeds[0]` does, silently discards
 * the rest — so say which one it was and let the caller decide.
 */
export type DiscoveredUrl =
  ({ kind: 'feed' } & DiscoveredFeedResult) | { kind: 'list'; feeds: Feed[] }

export async function discoverUrl(
  url: string,
  options?: DiscoverFeedOptions,
): Promise<DiscoveredUrl> {
  const normalizedUrl = normalizeUrl(url)

  if (!normalizedUrl) {
    throw new Error('URL is required')
  }

  // Discover feed from URL
  const feedResult = await fetchFeedsFromUrl(normalizedUrl)

  if (!feedResult) {
    throw new Error('No RSS feed found at this URL')
  }

  const feeds = Array.isArray(feedResult) ? feedResult : [feedResult]

  // More than one feed from a single URL means a subscription list. Its feeds carry
  // no items to enrich — fetching every one of them is the import's job, not this.
  if (feeds.length > 1) {
    return { kind: 'list', feeds }
  }

  const firstFeed = feeds[0]

  if (!firstFeed?.feedUrl) {
    throw new Error('Could not discover feed URL')
  }

  return { kind: 'feed', ...(await enrichDiscoveredFeed(firstFeed, normalizedUrl, options)) }
}

async function enrichDiscoveredFeed(
  feed: Feed,
  fallbackUrl: string,
  options?: DiscoverFeedOptions,
): Promise<DiscoveredFeedResult> {
  // Fetch the actual feed items
  const rssFeedResult = await fetchFeed(feed.feedUrl)
  const rssFeed: RSSFeed = rssFeedResult.feed

  // Prepare feed info
  const discoveredFeed: DiscoveredFeedInfo = {
    name: feed.name || rssFeed.title || 'Unknown Feed',
    url: feed.url || rssFeed.url || fallbackUrl,
    feedUrl: feed.feedUrl,
    favicon: typeof feed.favicon === 'string' ? feed.favicon : '',
    itemCount: rssFeed.items.length,
    enrich: looksLikeLinkAggregator(rssFeed.items, feed.feedUrl),
  }

  const items = options?.maxItems ? rssFeed.items.slice(0, options.maxItems) : rssFeed.items
  const posts = await enrichRssItems(items, discoveredFeed, options)

  return { feed: discoveredFeed, posts }
}

/**
 * The single-feed view of `discoverUrl`. A subscription list collapses to its first
 * feed here, which is all this shape can carry — use `discoverUrl` to see the rest.
 */
export async function discoverAndEnrichFeed(
  url: string,
  options?: DiscoverFeedOptions,
): Promise<DiscoveredFeedResult> {
  const result = await discoverUrl(url, options)

  if (result.kind === 'list') {
    const firstFeed = result.feeds[0]
    if (!firstFeed?.feedUrl) {
      throw new Error('Could not discover feed URL')
    }
    return enrichDiscoveredFeed(firstFeed, url, options)
  }

  return { feed: result.feed, posts: result.posts }
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
