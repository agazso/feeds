import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Post, RSSFeed } from '@feeds/core'
import {
  fetchFeedsFromUrl,
  fetchFeed,
  htmlToMarkdown,
  createEnrichedPost,
  createPost,
} from '@feeds/core'

interface DiscoveredFeed {
  name: string
  url: string
  feedUrl: string
  favicon: string
  itemCount: number
}

async function enrichWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000,
): Promise<T | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = await promise
    clearTimeout(timeoutId)
    return result
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const url = body.url?.toString()?.trim()

  if (!url) {
    return json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    // Discover feed from URL
    const feedResult = await fetchFeedsFromUrl(url)

    if (!feedResult) {
      return json({ error: 'No RSS feed found at this URL' }, { status: 400 })
    }

    // Handle single feed or array of feeds
    const feeds = Array.isArray(feedResult) ? feedResult : [feedResult]
    const firstFeed = feeds[0]

    if (!firstFeed?.feedUrl) {
      return json({ error: 'Could not discover feed URL' }, { status: 400 })
    }

    // Fetch the actual feed items
    const rssFeedResult = await fetchFeed(firstFeed.feedUrl)
    const rssFeed: RSSFeed = rssFeedResult.feed

    // Prepare feed info for UI
    const discoveredFeed: DiscoveredFeed = {
      name: firstFeed.name || rssFeed.title || 'Unknown Feed',
      url: firstFeed.url || rssFeed.url || url,
      feedUrl: firstFeed.feedUrl,
      favicon: typeof firstFeed.favicon === 'string' ? firstFeed.favicon : '',
      itemCount: rssFeed.items.length,
    }

    // Enrich all items using createEnrichedPost
    const posts: Post[] = (
      await Promise.all(
        rssFeed.items.map(async (item) => {
          if (!item.link) return null

          const enrichedResult = await enrichWithTimeout(
            createEnrichedPost(item.link, {
              rssItem: item,
              createdAt: item.created,
              feedName: discoveredFeed.name,
            }),
          )

          if (enrichedResult) {
            return enrichedResult.post
          }

          // Fallback: create post from RSS item only (no enrichment)
          return createPost({
            url: item.link,
            metadata: {
              title: item.title,
              description: htmlToMarkdown(item.description || ''),
            },
            originUrl: discoveredFeed.url,
            rssItem: item,
            createdAt: item.created,
            feedName: discoveredFeed.name,
          }).post
        }),
      )
    ).filter((post): post is Post => post !== null)

    return json({ feed: discoveredFeed, posts })
  } catch (e) {
    console.error('Discover error:', e)
    return json(
      { error: 'Failed to discover feed. Please check the URL and try again.' },
      { status: 500 },
    )
  }
}
