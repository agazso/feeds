import type { Feed, Post } from '@feeds/core'
import { loadPosts, fetchFeedPosts, getHumanHostname } from '@feeds/core'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dataDir } from './paths'

// Hosts whose feeds are cached instead of fetched live, because they rate-limit
// bulk requests (YouTube started per-IP limiting 2026-07). Add hosts to extend.
const CACHED_HOSTS = ['youtube.com']

const DEFAULT_TTL = 30 * 60_000 // used when a feed sends no Cache-Control max-age
const MIN_TTL = 5 * 60_000 // floor, so max-age=0/no-cache can't force a refetch every load
const MAX_REFRESH = 8 // cap live requests per load, so we never burst a rate limiter
const CONCURRENCY = 3

const cachePath = (user?: string) => join(dataDir(user), 'feed-cache.json')

// ttl is the feed's own Cache-Control max-age (clamped); staleness = now - fetchedAt > ttl.
type CacheEntry = { fetchedAt: number; ttl: number; posts: Post[] }
type FeedCache = Record<string, CacheEntry>

// Parse `max-age=<seconds>` from a Cache-Control header into a clamped ms TTL.
function ttlFromCacheControl(cacheControl?: string): number {
  const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1]
  return maxAge ? Math.max(Number(maxAge) * 1000, MIN_TTL) : DEFAULT_TTL
}

function isCached(feed: Feed): boolean {
  return CACHED_HOSTS.includes(getHumanHostname(feed.feedUrl))
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
    return !e || now - e.fetchedAt > (e.ttl ?? DEFAULT_TTL)
  }
  const toRefresh = cached
    .filter(isStale)
    .sort((a, b) => (cache[a.feedUrl]?.fetchedAt ?? 0) - (cache[b.feedUrl]?.fetchedAt ?? 0))
    .slice(0, MAX_REFRESH)

  await pool(toRefresh, CONCURRENCY, async (feed) => {
    try {
      const { posts, cacheControl } = await fetchFeedPosts(feed)
      if (posts.length > 0) {
        cache[feed.feedUrl] = { fetchedAt: now, ttl: ttlFromCacheControl(cacheControl), posts }
      }
    } catch {
      // network error / block → keep last-good entry
    }
  })
  if (toRefresh.length) await saveCache(cache, user)

  const cachedPosts = cached.flatMap((f) => cache[f.feedUrl]?.posts ?? [])
  return [...livePosts, ...cachedPosts]
}
