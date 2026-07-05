export interface RSSEnclosure {
  url: string
  length: string
  type: string
}

export interface RSSThumbnail {
  height: number[]
  width: number[]
  url: string[]
}

export interface RSSMedia {
  thumbnail: RSSThumbnail[]
}

export interface RSSItem {
  title: string
  description: string
  link: string
  url: string
  created: number
  enclosures?: RSSEnclosure[]
  media?: RSSMedia
  content?: string
  comments?: string
}

export interface RSSFeed {
  title: string
  description: string
  url: string
  icon?: string
  items: RSSItem[]
}

export interface RSSFeedWithMetrics {
  feed: RSSFeed
  url: string
  size: number
  downloadTime: number
  xmlTime: number
  parseTime: number
  cacheControl?: string // response Cache-Control header, for TTL-aware caching
}
