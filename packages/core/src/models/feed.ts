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
  // Link aggregators (Hacker News, Two Stop Bits) publish items that point at other
  // sites, so the RSS carries only the aggregator's own name and icon. With this set,
  // the feed page fetches each linked page instead — see loadEnrichedFeedPosts.
  enrich?: boolean
}
