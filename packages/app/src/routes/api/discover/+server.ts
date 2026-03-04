import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Post, RSSItem, RSSFeed, HtmlMetaData } from '@feeds/core'
import { fetchFeedsFromUrl, fetchFeed, htmlToMarkdown, fetchHtmlMetaDataOnly } from '@feeds/core'

interface DiscoveredFeed {
  name: string
  url: string
  feedUrl: string
  favicon: string
  itemCount: number
}

function getFirstImage(item: RSSItem): string | undefined {
  if (item.media?.thumbnail?.[0]?.url?.[0]) {
    return item.media.thumbnail[0].url[0]
  }
  if (item.enclosures?.[0]?.type?.startsWith('image/')) {
    return item.enclosures[0].url
  }
  return undefined
}

function createPostFromItem(
  item: RSSItem,
  feed: { name: string; url: string; favicon: string },
  enrichedData?: {
    title?: string
    description?: string
    image?: string
    icon?: string
    name?: string
    feedUrl?: string
    author?: string
  },
): Post {
  const title = enrichedData?.title || item.title || ''
  const description = enrichedData?.description || htmlToMarkdown(item.description || '')
  const image = enrichedData?.image || getFirstImage(item)

  const text = title && description ? `**${title}**\n\n${description}` : title || description

  return {
    _id: `${item.link}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: item.created || Date.now(),
    images: image ? [{ uri: image }] : [],
    link: item.link,
    author: {
      name: enrichedData?.author || enrichedData?.name || feed.name,
      uri: feed.url,
      image: { uri: enrichedData?.icon || feed.favicon },
    },
    rssItem: item,
    feedUrl: enrichedData?.feedUrl,
  }
}

async function enrichItemWithTimeout(
  url: string,
  timeoutMs: number = 5000,
): Promise<HtmlMetaData | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const metadata = await fetchHtmlMetaDataOnly(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    return metadata
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

async function enrichAllItems(
  items: RSSItem[],
  concurrencyLimit: number = 30,
): Promise<Map<string, HtmlMetaData>> {
  const results = new Map<string, HtmlMetaData>()

  // Process items in batches
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const batch = items.slice(i, i + concurrencyLimit)
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        if (!item.link) return { link: '', metadata: null }
        const metadata = await enrichItemWithTimeout(item.link)
        return { link: item.link, metadata }
      }),
    )

    for (const { link, metadata } of batchResults) {
      if (link && metadata) {
        results.set(link, metadata)
      }
    }
  }

  return results
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

    // Enrich all items automatically
    const enrichedData = await enrichAllItems(rssFeed.items)

    // Create posts from all items
    const posts: Post[] = rssFeed.items.map((item) => {
      const metadata = item.link ? enrichedData.get(item.link) : undefined
      return createPostFromItem(
        item,
        { name: discoveredFeed.name, url: discoveredFeed.url, favicon: discoveredFeed.favicon },
        metadata
          ? {
              title: metadata.title,
              description: metadata.description,
              image: metadata.image,
              icon: metadata.icon,
              name: metadata.name,
              feedUrl: metadata.feedUrl,
              author: metadata.author,
            }
          : undefined,
      )
    })

    return json({ feed: discoveredFeed, posts })
  } catch (e) {
    console.error('Discover error:', e)
    return json(
      { error: 'Failed to discover feed. Please check the URL and try again.' },
      { status: 500 },
    )
  }
}
