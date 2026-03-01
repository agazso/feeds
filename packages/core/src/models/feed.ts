import type { BundledImage } from './image-data'
import type { Model } from './model'

export interface Feed extends Model {
  name: string
  url: string
  feedUrl: string
  favicon: string | BundledImage
  followed?: boolean
  favorite?: boolean
  tags?: string[]
}
