import type { Feed, Post } from '@feeds/core'

// Re-export embedding-based tag functions
export { getEmbeddingBasedTags } from './embeddings'

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

/**
 * Build co-occurrence map: for each tag, count how often other tags appear with it
 */
export function buildTagCooccurrence(feeds: Feed[], posts: Post[] = []): Map<string, Map<string, number>> {
  const cooccurrence = new Map<string, Map<string, number>>()

  // Process all items with tags
  const taggedItems = [
    ...feeds.filter(f => f.tags?.length),
    ...posts.filter(p => p.tags?.length)
  ]

  for (const item of taggedItems) {
    const tags = item.tags!
    for (const tag of tags) {
      if (!cooccurrence.has(tag)) {
        cooccurrence.set(tag, new Map())
      }
      const tagMap = cooccurrence.get(tag)!
      for (const otherTag of tags) {
        if (otherTag !== tag) {
          tagMap.set(otherTag, (tagMap.get(otherTag) || 0) + 1)
        }
      }
    }
  }

  return cooccurrence
}

/**
 * Get suggested tags based on selected tags, ranked by co-occurrence frequency
 */
export function getSuggestedTags(
  selectedTags: string[],
  cooccurrence: Map<string, Map<string, number>>,
  limit: number = 5
): string[] {
  if (selectedTags.length === 0) return []

  // Aggregate scores from all selected tags
  const scores = new Map<string, number>()

  for (const selectedTag of selectedTags) {
    const related = cooccurrence.get(selectedTag)
    if (related) {
      for (const [tag, count] of related) {
        if (!selectedTags.includes(tag)) {
          scores.set(tag, (scores.get(tag) || 0) + count)
        }
      }
    }
  }

  // Sort by score descending, return top N
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag)
}

/**
 * Get suggested tags by matching available tags against text content
 * Matches whole words only, case-insensitive
 */
export function getContentBasedTags(
  text: string,
  availableTags: string[],
  limit: number = 5
): string[] {
  if (!text || availableTags.length === 0) return []

  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0)
  const wordSet = new Set(words)

  return availableTags
    .filter(tag => wordSet.has(tag.toLowerCase()))
    .slice(0, limit)
}

/**
 * Get tags from feeds whose URL hostname matches the given URL's hostname
 */
export function getTagsFromMatchingFeeds(
  url: string,
  feeds: Feed[]
): string[] {
  if (!url || feeds.length === 0) return []

  let targetHost: string
  try {
    targetHost = new URL(url).hostname
  } catch {
    return []
  }

  const tagSet = new Set<string>()
  for (const feed of feeds) {
    try {
      const feedHost = new URL(feed.url).hostname
      if (feedHost === targetHost && feed.tags) {
        for (const tag of feed.tags) {
          tagSet.add(tag)
        }
      }
    } catch {
      // Skip feeds with invalid URLs
    }
  }

  return Array.from(tagSet)
}
