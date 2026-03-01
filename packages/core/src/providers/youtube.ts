import type { Feed } from '../models/feed'
import { type ContentResult, fetchContentResult, fetchFeedFromUrl } from '../parsers/rss-post'
import * as urlUtils from '../utils/url'

export function isYoutubeLink(url: string): boolean {
  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  const humanHostName = urlUtils.getHumanHostname(canonicalUrl)
  return humanHostName === 'youtube.com'
}

export interface YoutubeFetchConfiguration {
  fetchContentResult: (url: string) => Promise<ContentResult | null>
  tryFetchFeedByContentWithMimeType: (
    inputUrl: string,
    contentResult: ContentResult,
  ) => Promise<Feed | Feed[] | undefined>
}

const defaultFetchConfiguration: YoutubeFetchConfiguration = {
  fetchContentResult,
  tryFetchFeedByContentWithMimeType: async (inputUrl, contentResult) => {
    // Simple implementation that tries to fetch as RSS
    const feed = await fetchFeedFromUrl(contentResult.url)
    return feed ?? undefined
  },
}

export async function fetchYoutubeFeed(
  url: string,
  fetchConfiguration: YoutubeFetchConfiguration = defaultFetchConfiguration,
): Promise<Feed | Feed[] | undefined> {
  const parsedUrl = new URL(urlUtils.getCanonicalUrl(url))

  if (parsedUrl.pathname?.startsWith('/channel/')) {
    const channelId = parsedUrl.pathname?.replace('/channel/', '')
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const feed = await fetchFeedFromUrl(feedUrl)
    if (feed != null) {
      return feed
    } else {
      return undefined
    }
  }

  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  const contentResult = await fetchConfiguration.fetchContentResult(canonicalUrl)
  if (contentResult != null) {
    const feed = await fetchConfiguration.tryFetchFeedByContentWithMimeType(
      canonicalUrl,
      contentResult,
    )
    if (feed != null) {
      if (!Array.isArray(feed) && parsedUrl.pathname?.startsWith('/@')) {
        const youtubeUrl = feed.url + parsedUrl.pathname.split('/')[1]
        return {
          ...feed,
          url: youtubeUrl,
        }
      }
      return feed
    }
  }

  return undefined
}
