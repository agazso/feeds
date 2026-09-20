import type { Feed } from '../models/feed'
import { type ContentResult, fetchContentResult, fetchFeedFromUrl } from '../parsers/rss-post'
import { timeout } from '../utils/timeout'
import * as urlUtils from '../utils/url'

/**
 * Resolve a YouTube channel feed (…/videos.xml?channel_id=UC…) to its channel page URL.
 * Prefers the @handle (read from the channel page HTML), falls back to /channel/<id>.
 */
export async function resolveYoutubeChannelUrl(
  feedUrl: string,
  init?: RequestInit,
): Promise<string | undefined> {
  let channelId: string | null = null
  try {
    channelId = new URL(feedUrl).searchParams.get('channel_id')
  } catch {
    return undefined
  }
  if (!channelId) return undefined

  const channelUrl = `https://www.youtube.com/channel/${channelId}`
  try {
    const res = await timeout(5000, fetch(channelUrl, init))
    if (res.ok) {
      const html = await res.text()
      const m = html.match(/"canonicalBaseUrl":"\/(@[^"]+)"/)
      if (m) return `https://www.youtube.com/${m[1]}`
    }
  } catch {
    // network/timeout failed → fall back to /channel/<id> (redirects to the channel)
  }
  return channelUrl // ponytail: /channel/<id> is a valid permanent channel link
}

export function isYoutubeLink(url: string): boolean {
  return urlUtils.isYoutubeUrl(url)
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
  // Already a channel RSS feed URL — fetch it directly; canonicalization would
  // strip the required channel_id query and break the request.
  if (url.includes('/feeds/videos.xml')) {
    const feed = await fetchFeedFromUrl(url)
    if (feed) {
      // augmentFeedWithMetadata sets feed.url to the atom <link rel="self"> (the
      // videos.xml URL); replace it with the channel page so the displayed link
      // points to the channel, not the feed file. feedUrl is left unchanged.
      feed.url = (await resolveYoutubeChannelUrl(url)) ?? feed.url
    }
    return feed ?? undefined
  }

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
        const youtubeUrl = `${parsedUrl.origin}/${parsedUrl.pathname.split('/')[1]}`
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
