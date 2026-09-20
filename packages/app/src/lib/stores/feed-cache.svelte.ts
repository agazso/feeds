import { SvelteMap } from 'svelte/reactivity'
import type { Post } from '@feeds/core'

export interface DiscoveredFeed {
  name: string
  url: string
  feedUrl: string
  favicon: string
  itemCount: number
}

interface FeedCacheItem {
  posts: Post[]
  feed: DiscoveredFeed
  expireAt: number
}

function createFeedCache() {
  const cache = $state<SvelteMap<string, FeedCacheItem>>(new SvelteMap())

  return {
    getFeedCache(url: string) {
      return cache.get(url)
    },
    setFeedCache(url: string, feedCacheItem: FeedCacheItem) {
      cache.set(url, feedCacheItem)
    },
    removeFeedCache(url: string) {
      cache.delete(url)
    },
  }
}

export const feedCache = createFeedCache()
