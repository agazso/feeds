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

  // The exec-loop idiom.
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

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function outline(feed: Feed): string {
  // `text` is the attribute the spec requires; `title` is what most readers show.
  const attrs: Array<[string, string]> = [
    ['type', 'rss'],
    ['text', feed.name || feed.feedUrl],
    ['title', feed.name || feed.feedUrl],
    ['xmlUrl', feed.feedUrl],
  ]
  if (feed.url) attrs.push(['htmlUrl', feed.url])
  // Comma-separated categories survive a round trip through most readers, so the
  // tags an export was filtered by are not lost on import.
  if (feed.tags?.length) attrs.push(['category', feed.tags.join(',')])
  const rendered = attrs.map(([k, v]) => `${k}="${escapeXmlAttribute(v)}"`).join(' ')
  return `    <outline ${rendered} />`
}

/**
 * Serialize feeds as an OPML 2.0 subscription list, the format every reader imports.
 * `parseOPML` reads the same shape back.
 */
export function buildOPML(feeds: Feed[], title: string, dateCreated = new Date()): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXmlAttribute(title)}</title>
    <dateCreated>${dateCreated.toUTCString()}</dateCreated>
  </head>
  <body>
${feeds.map(outline).join('\n')}
  </body>
</opml>
`
}
