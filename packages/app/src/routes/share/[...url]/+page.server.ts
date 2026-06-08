import type { PageServerLoad } from './$types'
import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { getTagsFromPosts, getTagsFromMatchingFeeds, getTagsFromExactFeedMatch } from '$lib/tags'

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
  
  if (feedUrlFromQuery) {
    // Use feedUrl for exact feed matching (most accurate)
    const decodedFeedUrl = decodeURIComponent(feedUrlFromQuery)
    const matchingFeed = config.feeds.find(feed => feed.feedUrl === decodedFeedUrl)
    if (matchingFeed?.tags) {
      feedTags = [...matchingFeed.tags]
    }
  }
  
  // Fallback: if no feedUrl or no match, use URL-based matching
  if (feedTags.length === 0) {
    const decodedPostUrl = decodeURIComponent(postUrl)
    feedTags = getTagsFromExactFeedMatch(decodedPostUrl, config.feeds)
  }

  return {
    url: decodeURIComponent(postUrl),
    availableTags: Array.from(tagSet).sort(),
    feeds: config.feeds,
    myfeedPosts,
    feedTags,  // Tags from the specific feed (or fallback to URL matching)
    feedUrl: feedUrlFromQuery ? decodeURIComponent(feedUrlFromQuery) : undefined  // Original feed context
  }
}
