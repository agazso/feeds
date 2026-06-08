import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { getTagsFromPosts } from '$lib/tags'
import { fetchFeedsFromUrl, timeout } from '@feeds/core'

export const load: PageServerLoad = async ({ params, url }) => {
  const postUrl = params.url || ''

  // Load available tags from config
  const config = await loadConfig()
  const tagSet = new Set<string>()

  for (const feed of config.feeds) {
    if (feed.tags) {
      for (const tag of feed.tags) {
        tagSet.add(tag)
      }
    }
  }

  // Add myfeed tags
  const myfeedPosts = await loadMyfeedPosts()
  for (const tag of getTagsFromPosts(myfeedPosts)) {
    tagSet.add(tag)
  }

  // Get feedUrl from query parameters if available
  const searchParams = new URL(url).searchParams
  const feedUrlFromQuery = searchParams.get('feedUrl')
  
  let feedTags: string[] = []
  // The feed context to record on the saved post (exact-matched against followed feeds)
  let resolvedFeedUrl = feedUrlFromQuery ? decodeURIComponent(feedUrlFromQuery) : undefined

  if (resolvedFeedUrl) {
    // Use feedUrl for exact feed matching (most accurate)
    const matchingFeed = config.feeds.find(feed => feed.feedUrl === resolvedFeedUrl)
    if (matchingFeed?.tags) {
      feedTags = [...matchingFeed.tags]
    }
  }

  // Fallback: no feedUrl context → discover the real feed for this URL and match it.
  // Hostname matching is wrong for platforms where many feeds share a host (e.g. YouTube
  // channels all live on www.youtube.com); discovery resolves the specific channel feed.
  if (feedTags.length === 0) {
    const decodedPostUrl = decodeURIComponent(postUrl)
    try {
      const discovered = await timeout(5000, fetchFeedsFromUrl(decodedPostUrl))
      const discoveredFeeds = Array.isArray(discovered) ? discovered : discovered ? [discovered] : []
      const discoveredFeedUrl = discoveredFeeds[0]?.feedUrl
      if (discoveredFeedUrl) {
        const matchingFeed = config.feeds.find(feed => feed.feedUrl === discoveredFeedUrl)
        if (matchingFeed?.tags) {
          feedTags = [...matchingFeed.tags]
          resolvedFeedUrl = matchingFeed.feedUrl
        }
      }
    } catch {
      // Discovery failed or timed out → leave feedTags empty (no auto-select)
    }
  }

  return {
    url: decodeURIComponent(postUrl),
    availableTags: Array.from(tagSet).sort(),
    feeds: config.feeds,
    myfeedPosts,
    feedTags,  // Tags from the specific matching feed (empty if no feed matches)
    feedUrl: resolvedFeedUrl  // Feed context for the saved post (query param or discovered match)
  }
}
