import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Feed, Post } from '@feeds/core'
import { fetchFeedPosts, getHumanHostname } from '@feeds/core'

// Warm static/feed-cache.json for rate-limited hosts (see feed-cache.ts) by fetching
// each feed sequentially with a delay, so a cold start never bursts the rate limiter.
const CACHED_HOSTS = ['youtube.com']
const DELAY_MS = 2500
const DEFAULT_TTL = 30 * 60_000
const MIN_TTL = 5 * 60_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function ttlFromCacheControl(cacheControl?: string): number {
  const maxAge = cacheControl?.match(/max-age=(\d+)/)?.[1]
  return maxAge ? Math.max(Number(maxAge) * 1000, MIN_TTL) : DEFAULT_TTL
}

async function main() {
  const configPath = join(process.cwd(), 'static', 'feeds.json')
  const config = JSON.parse(await readFile(configPath, 'utf-8'))
  const feeds: Feed[] = (config.feeds ?? []).filter((f: Feed) =>
    CACHED_HOSTS.includes(getHumanHostname(f.feedUrl)),
  )

  const cachePath = join(process.cwd(), 'static', 'feed-cache.json')
  let cache: Record<string, { fetchedAt: number; ttl: number; posts: Post[] }> = {}
  try {
    cache = JSON.parse(await readFile(cachePath, 'utf-8'))
  } catch {
    // no existing cache
  }

  let ok = 0
  for (const feed of feeds) {
    try {
      const { posts, cacheControl } = await fetchFeedPosts(feed)
      if (posts.length > 0) {
        cache[feed.feedUrl] = {
          fetchedAt: Date.now(),
          ttl: ttlFromCacheControl(cacheControl),
          posts,
        }
        ok++
        console.log(`OK   ${feed.name ?? feed.feedUrl} (${posts.length})`)
      } else {
        console.log(`EMPTY ${feed.name ?? feed.feedUrl} — kept previous`)
      }
    } catch {
      console.log(`FAIL ${feed.name ?? feed.feedUrl} — kept previous`)
    }
    await sleep(DELAY_MS)
  }

  await writeFile(cachePath, JSON.stringify(cache, null, 2))
  console.log(`Done. Refreshed ${ok}/${feeds.length} feeds.`)
}

main()
