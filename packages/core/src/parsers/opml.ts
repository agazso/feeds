import type { Feed } from '../models/feed'
import { getHttpsUrl } from '../utils/url'

export interface OPMLFeed {
  title: string
  url: string
  feedUrl: string
  feedType: string
}

export async function tryFetchOPML(url: string): Promise<Feed[] | undefined> {
  try {
    const response = await fetch(url)
    const xml = await response.text()
    return parseOPML(xml)
  } catch {
    return undefined
  }
}

export async function readOPML(xml: string): Promise<OPMLFeed[]> {
  return parseOPMLToFeeds(xml)
}

/**
 * Simple OPML parser using regex-based extraction
 */
function parseOPMLToFeeds(xml: string): OPMLFeed[] {
  const feeds: OPMLFeed[] = []
  const outlineRegex = /<outline[^>]*>/gi
  let match: RegExpExecArray | null

  // biome-ignore lint/suspicious/noAssignInExpressions: the exec-loop idiom
  while ((match = outlineRegex.exec(xml)) !== null) {
    const outline = match[0]

    // Extract attributes
    const xmlUrl = extractAttribute(outline, 'xmlUrl')
    const htmlUrl = extractAttribute(outline, 'htmlUrl')
    const title = extractAttribute(outline, 'title') || extractAttribute(outline, 'text')
    const type = extractAttribute(outline, 'type')

    if (xmlUrl) {
      feeds.push({
        title: title || '',
        url: htmlUrl || '',
        feedUrl: xmlUrl,
        feedType: type || 'rss',
      })
    }
  }

  return feeds
}

function extractAttribute(tag: string, name: string): string {
  const regex = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  const match = tag.match(regex)
  return match?.[1] ?? ''
}

export async function parseOPML(xml: string): Promise<Feed[] | undefined> {
  try {
    const opmlFeeds = parseOPMLToFeeds(xml)
    if (opmlFeeds.length === 0) {
      return undefined
    }

    const feeds = await convertOPMLFeeds(opmlFeeds)
    const isFeed = (feed: Feed | undefined): feed is Feed => feed != null
    return feeds.filter<Feed>(isFeed)
  } catch {
    return undefined
  }
}

function findBestAlternative(alternatives: (string | undefined)[]) {
  for (const alt of alternatives) {
    if (alt != null && alt !== '') {
      return alt
    }
  }
  return ''
}

export async function convertOPMLFeed(opmlFeed: OPMLFeed): Promise<Feed | undefined> {
  const feedUrl = getHttpsUrl(opmlFeed.feedUrl)
  try {
    // We just create a basic feed from OPML data
    // The full feed fetching would create circular dependencies
    const completeFeed: Feed = {
      name: findBestAlternative([opmlFeed.title]),
      url: findBestAlternative([opmlFeed.url]),
      feedUrl: feedUrl,
      favicon: '',
      followed: true,
    }
    return completeFeed
  } catch {
    return undefined
  }
}

export async function convertOPMLFeeds(opmlFeeds: OPMLFeed[]): Promise<(Feed | undefined)[]> {
  return Promise.all(opmlFeeds.map((opmlFeed) => convertOPMLFeed(opmlFeed)))
}
