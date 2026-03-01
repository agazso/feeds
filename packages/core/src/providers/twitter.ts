import type { Feed } from '../models/feed'
import { fetchHtmlMetaDataOnly } from '../parsers/html-metadata'
import { fetchFeedFromUrl } from '../parsers/rss-post'
import * as urlUtils from '../utils/url'

export function isTwitterLink(url: string): boolean {
  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  const humanHostName = urlUtils.getHumanHostname(canonicalUrl)
  return humanHostName === 'twitter.com' || humanHostName === 'x.com'
}

export async function fetchTwitterFeed(url: string): Promise<Feed | undefined> {
  // Replace twitter.com or x.com with nitter.net for RSS feeds
  const nitterUrl = url.replace('twitter.com', 'nitter.net').replace('x.com', 'nitter.net')
  const canonicalUrl = urlUtils.getCanonicalUrl(nitterUrl)
  const feed = await fetchFeedFromUrl(canonicalUrl)
  if (!feed) {
    return undefined
  }
  const pageUrl = feed.feedUrl.replace(/\/rss$/, '')
  try {
    const meta = await fetchHtmlMetaDataOnly(pageUrl)
    const favicon = meta.image ?? feed.favicon
    return {
      ...feed,
      favicon,
    }
  } catch {
    return feed
  }
}
