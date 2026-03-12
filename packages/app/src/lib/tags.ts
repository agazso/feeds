import type { Feed, Post } from '@feeds/core'

/**
 * Filter feeds to only those that have ALL specified tags
 */
export function filterFeedsByTags(feeds: Feed[], tags: string[]): Feed[] {
  if (tags.length === 0) {
    return feeds
  }
  return feeds.filter((feed) => {
    if (!feed.tags || feed.tags.length === 0) {
      return false
    }
    return tags.every((tag) => feed.tags!.includes(tag))
  })
}

/**
 * Get all unique tags from feeds, sorted alphabetically
 */
export function getAllTags(feeds: Feed[]): string[] {
  const tagSet = new Set<string>()
  for (const feed of feeds) {
    if (feed.tags) {
      for (const tag of feed.tags) {
        tagSet.add(tag)
      }
    }
  }
  return Array.from(tagSet).sort()
}

/**
 * Parse tags from URL path segment (e.g., "youtube+music" -> ["youtube", "music"])
 */
export function parseTagsFromPath(path: string): string[] {
  if (!path) {
    return []
  }
  return path
    .split('+')
    .map((tag) => decodeURIComponent(tag.trim()))
    .filter((tag) => tag.length > 0)
}

/**
 * Format tags for URL path (e.g., ["youtube", "music"] -> "youtube+music")
 */
export function formatTagsForPath(tags: string[]): string {
  return tags.map((tag) => encodeURIComponent(tag)).join('+')
}

/**
 * Get all unique tags from posts, sorted alphabetically
 */
export function getTagsFromPosts(posts: Post[]): string[] {
  const tagSet = new Set<string>()
  for (const post of posts) {
    if (post.tags) {
      for (const tag of post.tags) {
        tagSet.add(tag)
      }
    }
  }
  return Array.from(tagSet).sort()
}

/**
 * Filter posts to only those that have ALL specified tags
 */
export function filterPostsByTags(posts: Post[], tags: string[]): Post[] {
  if (tags.length === 0) {
    return posts
  }
  return posts.filter((post) => {
    if (!post.tags || post.tags.length === 0) {
      return false
    }
    return tags.every((tag) => post.tags!.includes(tag))
  })
}
