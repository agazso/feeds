import type { Feed } from './models/feed'
import type { BundledImage, ImageData } from './models/image-data'
import { parseOPML } from './parsers/opml'
import {
  type ContentResult,
  type ContentWithMimeType,
  fetchContentResult,
  fetchFeedByContentWithMimeType,
} from './parsers/rss-post'
import { fetchRedditFeed, isRedditLink } from './providers/reddit'
import { fetchTwitterFeed, isTwitterLink } from './providers/twitter'
import { fetchYoutubeFeed, isYoutubeLink } from './providers/youtube'
import * as urlUtils from './utils/url'

export const FELFELE_FEEDS_MIME_TYPE = 'application/felfele-feeds+json'

function isBundledImage(favicon: string | BundledImage): favicon is BundledImage {
  return typeof favicon === 'number'
}

export function getFeedImage(feed: Feed): ImageData {
  if (isBundledImage(feed.favicon)) {
    return {
      localPath: feed.favicon,
    }
  }
  const image: ImageData = {
    uri: feed.favicon,
  }
  return image
}

export function sortFeedsByName(feeds: Feed[]): Feed[] {
  return feeds.sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()))
}

function tryFetchFelfeleFeeds(result: ContentResult): Feed[] | undefined {
  try {
    const data = JSON.parse(result.content) as { feeds: Feed[] }
    const rssFeeds = data.feeds.filter(
      (feed) => urlUtils.getHttpLinkFromText(feed.feedUrl) === feed.feedUrl,
    )
    return rssFeeds
  } catch {
    return undefined
  }
}

export interface FetchConfiguration {
  fetchFeedByContentWithMimeType: (
    url: string,
    contentWithMimeType: ContentWithMimeType,
  ) => Promise<Feed | null>
  fetchContentResult: (url: string) => Promise<ContentResult | null>
  parseOPML: (xml: string) => Promise<Feed[] | undefined>
}

const defaultFetchConfiguration: FetchConfiguration = {
  fetchFeedByContentWithMimeType,
  fetchContentResult,
  parseOPML,
}

export async function tryFetchFeedByContentWithMimeType(
  inputUrl: string,
  contentResult: ContentResult,
  fetchConfiguration = defaultFetchConfiguration,
): Promise<Feed | Feed[] | undefined> {
  if (contentResult.mimeType === FELFELE_FEEDS_MIME_TYPE) {
    return tryFetchFelfeleFeeds(contentResult)
  }
  const feed = await fetchConfiguration.fetchFeedByContentWithMimeType(
    contentResult.url,
    contentResult,
  )
  if (feed != null) {
    return feed
  }
  const feeds = await fetchConfiguration.parseOPML(contentResult.content)
  if (feeds != null) {
    return feeds
  }

  return undefined
}

export async function fetchFeedsFromUrl(
  inputUrl: string,
  fetchConfiguration = defaultFetchConfiguration,
): Promise<Feed | Feed[] | undefined> {
  // handling keywords, e.g. someone types "the verge"
  let url = inputUrl
  if (url.includes(' ')) {
    url = url.replace(/ /g, '')
  }
  if (!url.includes('.')) {
    url += '.com'
  }

  // special cases for certain websites
  if (isRedditLink(url)) {
    return fetchRedditFeed(url)
  }

  if (isYoutubeLink(url)) {
    return fetchYoutubeFeed(url, {
      fetchContentResult: fetchConfiguration.fetchContentResult,
      tryFetchFeedByContentWithMimeType: (inputUrl, contentResult) =>
        tryFetchFeedByContentWithMimeType(inputUrl, contentResult, fetchConfiguration),
    })
  }

  if (isTwitterLink(url)) {
    return fetchTwitterFeed(url)
  }

  // first try with the url the user entered
  const originalContentResult = await fetchConfiguration.fetchContentResult(url)
  if (originalContentResult != null) {
    const originalUrlFeed = await tryFetchFeedByContentWithMimeType(
      inputUrl,
      originalContentResult,
      fetchConfiguration,
    )
    if (originalUrlFeed != null) {
      return originalUrlFeed
    }
  }

  // if the url the user entered did not work, form a canonical url and try with that
  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  const result = await fetchConfiguration.fetchContentResult(canonicalUrl)
  if (result != null) {
    const feed = await tryFetchFeedByContentWithMimeType(inputUrl, result, fetchConfiguration)
    if (feed != null) {
      return feed
    }
  }

  return undefined
}

function feedId(feed: Feed) {
  return feed.feedUrl
}

function areFeedsEqual(feedA: Feed, feedB: Feed): boolean {
  return feedId(feedA) === feedId(feedB)
}

export function mergeFeeds(feedsA: Feed[], feedsB: Feed[]): Feed[] {
  return feedsA
    .concat(feedsB)
    .sort((a, b) => feedId(a).localeCompare(feedId(b)))
    .filter((value, i, feeds) =>
      i + 1 < feeds.length ? areFeedsEqual(value, feeds[i + 1] as Feed) === false : true,
    )
}
