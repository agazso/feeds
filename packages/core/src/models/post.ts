import type { Author } from './author'
import type { ImageData } from './image-data'
import type { Model } from './model'
import type { RSSItem } from './rss'

export interface PublicPost extends Model {
  images: ImageData[]
  text: string
  createdAt: number
}

/** The link aggregator a post reached us through — see `Post.via`. */
export interface PostVia {
  name: string
  url: string
  icon?: string
}

export interface Post extends PublicPost {
  link?: string
  author?: Author
  updatedAt?: number
  rssItem?: RSSItem
  tags?: string[]
  feedUrl?: string
  /**
   * Set when an enriched post came via a link aggregator. Enrichment replaces the author
   * with the linked site's, and can even replace feedUrl with that site's own feed, so
   * without this nothing on the post points back at Hacker News.
   */
  via?: PostVia
}
