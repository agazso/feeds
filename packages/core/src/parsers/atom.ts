import type { RSSFeed, RSSItem, RSSMedia } from '../models/rss'

function getEntryDate(entry: Record<string, unknown>): string | null {
  const published = entry.published as string[] | undefined
  const updated = entry.updated as string[] | undefined
  if (published != null) {
    return published[0] ?? null
  }
  if (updated != null) {
    return updated[0] ?? null
  }
  return null
}

interface AtomMediaThumbnail {
  url: string[]
  width: string[]
  height: string[]
}

interface AtomMediaGroup {
  'media:thumbnail': AtomMediaThumbnail[]
}

function getAtomEntryMedia(entry: Record<string, unknown>): RSSMedia | undefined {
  const atomMediaGroup = entry['media:group'] as AtomMediaGroup[] | undefined
  const atomMediaThumbnail = atomMediaGroup?.[0]?.['media:thumbnail']?.[0]
  if (atomMediaThumbnail != null) {
    try {
      return {
        thumbnail: [
          {
            url: [atomMediaThumbnail.url[0] ?? ''],
            width: [Number.parseInt(atomMediaThumbnail.width[0] ?? '0', 10)],
            height: [Number.parseInt(atomMediaThumbnail.height[0] ?? '0', 10)],
          },
        ],
      }
    } catch {
      return undefined
    }
  }
  return undefined
}

interface AtomLink {
  rel?: string[]
  type?: string[]
  href: string[]
}

function findBestLink(entry: Record<string, unknown>): string {
  const links = entry.link as AtomLink[] | undefined
  if (!links) {
    return ''
  }

  const htmlLinks: AtomLink[] = []
  for (const link of links) {
    if (link.rel && link.rel[0] === 'alternate') {
      return link.href[0] ?? ''
    }
    if (link.type && link.type[0] === 'text/html') {
      htmlLinks.push(link)
    }
  }

  if (htmlLinks.length > 0) {
    return htmlLinks[0]?.href[0] ?? ''
  }

  if (links.length > 0) {
    const firstLink = links[0]
    return typeof firstLink === 'string' ? firstLink : (firstLink?.href[0] ?? '')
  }

  return ''
}

interface AtomTitle {
  _?: string
}

interface AtomFeed {
  title?: (string | AtomTitle)[]
  icon?: string[]
  link?: AtomLink[]
  entry: Record<string, unknown>[]
}

interface AtomJson {
  feed: AtomFeed
}

export function parseAtomFeed(json: AtomJson): RSSFeed {
  const feed = json.feed
  const rss: RSSFeed = {
    title: '',
    description: '',
    url: '',
    items: [],
  }

  if (feed.title) {
    const firstTitle = feed.title[0]
    rss.title = typeof firstTitle === 'string' ? firstTitle : ((firstTitle as AtomTitle)?._ ?? '')
  }
  if (feed.icon) {
    rss.icon = feed.icon[0]
  }
  if (feed.link) {
    rss.url = feed.link[0]?.href[0] ?? ''
  }

  rss.items = feed.entry.map((entry: Record<string, unknown>) => {
    const entryDate = getEntryDate(entry)
    const link = findBestLink(entry)
    const title = entry.title as (string | AtomTitle)[] | undefined
    const summary = entry.summary as { _?: string }[] | undefined
    const content = entry.content as { _?: string }[] | undefined

    const item: RSSItem = {
      title: title
        ? typeof title[0] === 'string'
          ? title[0]
          : ((title[0] as AtomTitle)?._ ?? '')
        : '',
      description: summary ? (summary[0]?._ ?? '') : content ? (content[0]?._ ?? '') : '',
      created: entryDate ? Date.parse(entryDate) : Date.now(),
      link,
      url: link,
      media: getAtomEntryMedia(entry),
    }
    return item
  })

  return rss
}
