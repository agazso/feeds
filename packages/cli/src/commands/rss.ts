import {
  type Feed,
  fetchFeedFromUrl,
  fetchFeedsFromUrl,
  getCanonicalUrl,
  loadPosts,
} from '@feeds/core'

export async function fetchRssFeed(url: string): Promise<Feed | null> {
  const canonicalUrl = getCanonicalUrl(url)
  return fetchFeedFromUrl(canonicalUrl)
}

export async function discoverFeeds(url: string): Promise<Feed | Feed[] | undefined> {
  return fetchFeedsFromUrl(url)
}

export async function fetchPostsFromFeeds(feeds: Feed[]): Promise<ReturnType<typeof loadPosts>> {
  return loadPosts(feeds)
}
