import type { Feed, Post } from '@feeds/core'
import { fetchFeedPosts, getHumanHostname, loadEnrichedFeedPosts, loadPosts } from '@feeds/core'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dataDir } from './paths'

// Hosts whose feeds are cached instead of fetched live, because they rate-limit
// bulk requests (YouTube started per-IP limiting 2026-07). Add hosts to extend.
const CACHED_HOSTS = ['youtube.com']

const DEFAULT_TTL = 30 * 60_000 // used when a feed sends no Cache-Control max-age
const MIN_TTL = 5 * 60_000 // floor, so max-age=0/no-cache can't force a refetch every load
const MAX_REFRESH = 8 // cap live requests per load, so we never burst a rate limiter
// An enriched refresh costs a page fetch per *new* item, so its worst case is far more
// expensive than a plain one. Refreshing at most this many per load keeps a batch of
// simultaneously-stale aggregators from stalling /all-posts or /tags.
const MAX_ENRICH_REFRESH = 2
const CONCURRENCY = 3

const cachePath = (user?: string) => join(dataDir(user), 'feed-cache.json')

// Bump whenever the shape of a built post changes. Without this, entries written by an
// older build are served as-is, and — because an enriched refresh reuses cached posts
// verbatim for unchanged links — items that stay in a feed would never pick the change up.
const POSTS_VERSION = 3

// ttl is the feed's own Cache-Control max-age (clamped); staleness = now - fetchedAt > ttl.
// `enriched` records which rendering produced these posts, so toggling feed.enrich
// invalidates the entry instead of serving posts of the wrong kind until the TTL runs out.
type CacheEntry = {
  fetchedAt: number
  ttl: number
  posts: Post[]
  enriched?: boolean
  version?: number
}
type FeedCache = Record<string, CacheEntry>

// Parse `max-age=<seconds>` from a Cache-Control header into a clamped ms TTL.
function ttlFromCacheControl(cacheControl?: string): number {
  const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1]
  return maxAge ? Math.max(Number(maxAge) * 1000, MIN_TTL) : DEFAULT_TTL
}

// Enriched feeds are cached for a different reason than CACHED_HOSTS: not rate limits,
// but cost — one page fetch per item. Without this they could only be rendered on the
// feed's own page; cached, they can appear in /all-posts and /tags too.
function isCached(feed: Feed): boolean {
  return feed.enrich === true || CACHED_HOSTS.includes(getHumanHostname(feed.feedUrl))
}

/** Refetch a feed, reusing already-enriched posts for items that haven't changed. */
async function refetch(
  feed: Feed,
  previous?: CacheEntry,
): Promise<{ posts: Post[]; cacheControl?: string }> {
  if (!feed.enrich) return fetchFeedPosts(feed)
  // Only reuse posts this build would have produced itself.
  const current = previous?.enriched && previous.version === POSTS_VERSION
  return {
    posts: await loadEnrichedFeedPosts(feed, { reuse: current ? previous.posts : undefined }),
  }
}

async function loadCache(user?: string): Promise<FeedCache> {
  try {
    return JSON.parse(await readFile(cachePath(user), 'utf-8'))
  } catch {
    return {}
  }
}

async function saveCache(cache: FeedCache, user?: string): Promise<void> {
  await writeFile(cachePath(user), JSON.stringify(cache, null, 2))
}

// Run `fn` over `items` with at most `n` in flight. No dependency needed.
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

/**
 * Like core `loadPosts`, but feeds on a rate-limited host (see CACHED_HOSTS) are
 * served from a per-feed disk cache: each is refetched at most once per TTL, at most
 * MAX_REFRESH per load, and a failed/empty refresh keeps the last good copy so a feed
 * never goes blank. All other feeds are fetched live and fresh, unchanged.
 */
export async function loadPostsCached(feeds: Feed[], user?: string): Promise<Post[]> {
  const cached = feeds.filter(isCached)
  const live = feeds.filter((f) => !isCached(f))

  const livePosts = live.length ? await loadPosts(live) : []
  if (cached.length === 0) return livePosts

  const cache = await loadCache(user)
  const now = Date.now()
  const isStale = (f: Feed) => {
    const e = cache[f.feedUrl]
    if (!e) return true
    if (e.version !== POSTS_VERSION) return true // built by an older version of the app
    if (!!e.enriched !== (f.enrich === true)) return true // rendering mode was toggled
    return now - e.fetchedAt > (e.ttl ?? DEFAULT_TTL)
  }
  const stale = cached
    .filter(isStale)
    .sort((a, b) => (cache[a.feedUrl]?.fetchedAt ?? 0) - (cache[b.feedUrl]?.fetchedAt ?? 0))

  // Oldest-first within each budget; whatever misses out keeps serving its last copy
  // and is refreshed on a later load.
  let enrichBudget = MAX_ENRICH_REFRESH
  const toRefresh = stale.filter((feed) => !feed.enrich || enrichBudget-- > 0).slice(0, MAX_REFRESH)

  await pool(toRefresh, CONCURRENCY, async (feed) => {
    try {
      const { posts, cacheControl } = await refetch(feed, cache[feed.feedUrl])
      if (posts.length > 0) {
        cache[feed.feedUrl] = {
          fetchedAt: now,
          ttl: ttlFromCacheControl(cacheControl),
          posts,
          enriched: feed.enrich === true,
          version: POSTS_VERSION,
        }
      }
    } catch {
      // network error / block → keep last-good entry
    }
  })
  if (toRefresh.length) await saveCache(cache, user)

  const cachedPosts = cached.flatMap((f) => cache[f.feedUrl]?.posts ?? [])
  return [...livePosts, ...cachedPosts]
}
