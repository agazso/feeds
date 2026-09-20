import { fetchFeedsFromUrl, timeout } from '@feeds/core'
import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { collectAvailableTags } from '$lib/tags'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const postUrl = params.url || ''

  const config = await loadConfig(locals.user)
  const myfeedPosts = await loadMyfeedPosts(locals.user)
  const availableTags = collectAvailableTags(config.feeds, myfeedPosts)

  // Get feedUrl from query parameters if available
  const searchParams = new URL(url).searchParams
  const feedUrlFromQuery = searchParams.get('feedUrl')

  let feedTags: string[] = []
  // The feed context to record on the saved post (exact-matched against followed feeds)
  let resolvedFeedUrl = feedUrlFromQuery ? decodeURIComponent(feedUrlFromQuery) : undefined

  if (resolvedFeedUrl) {
    // Use feedUrl for exact feed matching (most accurate)
    const matchingFeed = config.feeds.find((feed) => feed.feedUrl === resolvedFeedUrl)
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
      const discoveredFeeds = Array.isArray(discovered)
        ? discovered
        : discovered
          ? [discovered]
          : []
      const discoveredFeedUrl = discoveredFeeds[0]?.feedUrl
      if (discoveredFeedUrl) {
        const matchingFeed = config.feeds.find((feed) => feed.feedUrl === discoveredFeedUrl)
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
    availableTags,
    feeds: config.feeds,
    myfeedPosts,
    feedTags, // Tags from the specific matching feed (empty if no feed matches)
    feedUrl: resolvedFeedUrl, // Feed context for the saved post (query param or discovered match)
  }
}
