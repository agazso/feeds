import type { Feed } from '../models/feed'
import { fetchHtmlMetaDataOnly } from '../parsers/html-metadata'
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
  let channelId: string | null
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

/**
 * The channel page URL when `url` already is one — /@handle, /c/x or /user/x, with any
 * sub-path (/videos, /streams) trimmed. Undefined for a video page, whose own URL is
 * not something to show as the feed's home. Read from the URL as given: canonicalizing
 * drops the query a /watch URL needs.
 */
export function youtubeChannelPageUrl(url: string): string | undefined {
  try {
    const { origin, pathname } = new URL(urlUtils.getHttpsUrl(url))
    const match = pathname.match(/^\/(@[^/]+|c\/[^/]+|user\/[^/]+)/)
    return match ? `${origin}/${match[1]}` : undefined
  } catch {
    return undefined
  }
}

/**
 * Every YouTube page — a video or a channel — carries its channel id in the page HTML,
 * which `parseHtmlMetaData` turns into the channel's feed URL. This is the only route
 * that works for /watch: `getCanonicalUrl` strips the `?v=` that identifies the video,
 * leaving youtube.com/watch, which has no feed. It is what the share path already does.
 */
async function fetchYoutubeFeedFromPage(url: string): Promise<Feed | undefined> {
  let feedUrl: string
  try {
    feedUrl = (await fetchHtmlMetaDataOnly(url)).feedUrl
  } catch {
    return undefined
  }
  if (!feedUrl.includes('/feeds/videos.xml')) return undefined

  const feed = await fetchFeedFromUrl(feedUrl)
  if (!feed) return undefined
  // A channel page is already the link to show, and saying so here avoids the extra
  // fetch resolveYoutubeChannelUrl would make to find out.
  feed.url = youtubeChannelPageUrl(url) ?? (await resolveYoutubeChannelUrl(feedUrl)) ?? feed.url
  return feed
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
    // Handed to the branch above rather than fetched here, so feed.url ends up the
    // channel page too; fetching it directly left the videos.xml self-link showing.
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    return fetchYoutubeFeed(feedUrl, fetchConfiguration)
  }

  const fromPage = await fetchYoutubeFeedFromPage(url)
  if (fromPage) return fromPage

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
