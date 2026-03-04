import type { Author } from './author'
import type { ImageData } from './image-data'
import type { Model } from './model'
import type { RSSItem } from './rss'

export interface PublicPost extends Model {
  images: ImageData[]
  text: string
  createdAt: number
}

export interface Post extends PublicPost {
  link?: string
  author?: Author
  updatedAt?: number
  rssItem?: RSSItem
  tags?: string[]
  feedUrl?: string
}
