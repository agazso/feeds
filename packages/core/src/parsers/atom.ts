import he from 'he'
import type { RSSFeed, RSSItem, RSSMedia } from '../models/rss'

/** Read the text of an Atom node, handling array/object (`_text`/`_`)/string forms. */
function atomText(node: unknown): string {
  const first = Array.isArray(node) ? node[0] : node
  if (first == null) return ''
  if (typeof first === 'string') return first
  const o = first as { _text?: string; _?: string }
  return o._text ?? o._ ?? ''
}

/**
 * Reddit's Atom feed embeds the post image in the entry `<content>` HTML rather than
 * a `media:thumbnail`. Extract the first `<img>` as a thumbnail, scoped to Reddit's
 * image CDNs so no other Atom feed's behavior changes.
 */
function getImageFromAtomContent(content: unknown): RSSMedia | undefined {
  const html = atomText(content)
  const m = html.match(/<img[^>]+src="([^"]+)"/i)
  if (!m?.[1]) return undefined
  const url = he.decode(m[1])
  if (!/(^|\.)redd\.it\//.test(url)) return undefined
  return { thumbnail: [{ url: [url], width: [0], height: [0] }] }
}

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
  url: string
  width: string
  height: string
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
            url: [atomMediaThumbnail.url ?? ''],
            width: [Number.parseInt(atomMediaThumbnail.width ?? '0', 10)],
            height: [Number.parseInt(atomMediaThumbnail.height ?? '0', 10)],
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
  rel?: string | string[]
  type?: string | string[]
  href: string | string[]
}

function getAttr(value: string | string[] | undefined): string {
  if (!value) return ''
  return Array.isArray(value) ? (value[0] ?? '') : value
}

function findBestLink(entry: Record<string, unknown>): string {
  const links = entry.link as AtomLink[] | undefined
  if (!links) {
    return ''
  }

  const htmlLinks: AtomLink[] = []
  for (const link of links) {
    const rel = getAttr(link.rel)
    const type = getAttr(link.type)
    const href = getAttr(link.href)

    if (rel === 'alternate') {
      return href
    }
    if (type === 'text/html') {
      htmlLinks.push(link)
    }
  }

  if (htmlLinks.length > 0) {
    return getAttr(htmlLinks[0]?.href)
  }

  if (links.length > 0) {
    const firstLink = links[0]
    return typeof firstLink === 'string' ? firstLink : getAttr(firstLink?.href)
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
    rss.url = getAttr(feed.link[0]?.href)
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
      media: getAtomEntryMedia(entry) ?? getImageFromAtomContent(entry.content),
    }
    return item
  })

  return rss
}
