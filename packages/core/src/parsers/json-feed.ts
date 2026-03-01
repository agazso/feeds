import type { RSSEnclosure, RSSFeed, RSSItem, RSSThumbnail } from '../models/rss'

/**
 * JSON Feed 1.1 TypeScript Interfaces
 * https://www.jsonfeed.org/version/1.1/
 */

export interface JsonFeedAttachment {
  url: string
  mime_type: string
  title?: string
  size_in_bytes?: number
  duration_in_seconds?: number
}

export interface JsonFeedAuthor {
  name?: string
  url?: string
  avatar?: string
}

export interface JsonFeedItem {
  id: string
  url?: string
  external_url?: string
  title?: string
  content_html?: string
  content_text?: string
  summary?: string
  image?: string
  banner_image?: string
  date_published?: string
  date_modified?: string
  authors?: JsonFeedAuthor[]
  tags?: string[]
  language?: string
  attachments?: JsonFeedAttachment[]
}

export interface JsonFeed {
  version: string
  title: string
  home_page_url?: string
  feed_url?: string
  description?: string
  user_comment?: string
  next_url?: string
  icon?: string
  favicon?: string
  authors?: JsonFeedAuthor[]
  language?: string
  expired?: boolean
  items: JsonFeedItem[]
}

/**
 * Check if a parsed JSON object is a JSON Feed by looking for the version field
 * containing "jsonfeed.org"
 */
export function isJsonFeed(json: unknown): json is JsonFeed {
  if (typeof json !== 'object' || json === null) {
    return false
  }
  const obj = json as Record<string, unknown>
  return typeof obj.version === 'string' && obj.version.includes('jsonfeed.org')
}

/**
 * Convert a JSON Feed attachment to an RSS enclosure
 */
function convertAttachment(attachment: JsonFeedAttachment): RSSEnclosure {
  return {
    url: attachment.url,
    type: attachment.mime_type,
    length: attachment.size_in_bytes?.toString() ?? '',
  }
}

/**
 * Convert a JSON Feed item to an RSS item
 */
function convertItem(item: JsonFeedItem): RSSItem {
  const description = item.content_html ?? item.content_text ?? item.summary ?? ''
  const link = item.url ?? item.external_url ?? ''
  const created = item.date_published ? Date.parse(item.date_published) : 0

  // Build media thumbnail from image if present
  let media: { thumbnail: RSSThumbnail[] } | undefined
  if (item.image) {
    media = {
      thumbnail: [
        {
          url: [item.image],
          width: [],
          height: [],
        },
      ],
    }
  }

  // Convert attachments to enclosures
  let enclosures: RSSEnclosure[] | undefined
  if (item.attachments && item.attachments.length > 0) {
    enclosures = item.attachments.map(convertAttachment)
  }

  return {
    title: item.title ?? '',
    description,
    link,
    url: link,
    created,
    media,
    enclosures,
  }
}

/**
 * Parse a JSON Feed and convert it to an RSSFeed
 */
export function parseJsonFeed(json: JsonFeed): RSSFeed {
  const items = json.items.map(convertItem)

  return {
    title: json.title,
    description: json.description ?? '',
    url: json.home_page_url ?? '',
    icon: json.icon ?? json.favicon,
    items,
  }
}
