import type { Post } from '@feeds/core'
import { getHumanHostname } from '@feeds/core'

interface NormalizedPost extends Post {
  index: Record<string, string>
}

interface ScoredPost extends NormalizedPost {
  score: number
}

function normalizeString(s: string | undefined): string {
  if (!s) {
    return ''
  }
  return s
    .normalize('NFD')
    // Remove diacritical marks (accents) from characters
    .replace(/\p{Diacritic}/gu, '')
    // Keep only letters, digits, spaces, and hyphens (for negative search)
    // Note: hyphen must be at start of character class to be treated literally
    .replace(/[^-\p{Letter}0-9 ]/gu, '')
    .toLowerCase()
}

function normalizePost(post: Post): NormalizedPost {
  const authorName = post.author?.name ? normalizeString(post.author.name) : ''
  const authorUrl = post.author?.uri ? getHumanHostname(post.author.uri) : ''
  const text = normalizeString(post.text)
  const tags = post.tags || []
  const urlParts = authorUrl.split('/')
  const normalizedText = [
    ' ',
    ...tags,
    ...tags.map((tag) => `#${tag}`),
    authorName,
    ...urlParts,
    text,
  ].join(' ')
  const textSet = new Set<string>(
    normalizedText.split(' ').filter((word) => ![' ', ''].includes(word)),
  )
  const index = Array.from(textSet).reduce<Record<string, string>>(
    (acc, v) => ({ ...acc, [v[0]]: acc[v[0]] ? acc[v[0]] + ' ' + v : ' ' + v }),
    {},
  )

  return { ...post, index }
}

function scorePost(post: NormalizedPost, expr: string): number {
  const words = expr.split(' ').filter((word) => word !== '')
  let score = 0
  for (const word of words) {
    const isNegative = word.startsWith('-')
    const searchTerm = isNegative ? word.slice(1) : word
    const matched = post.index[searchTerm[0]]?.includes(' ' + searchTerm)
    if (matched) {
      if (isNegative) {
        return 0
      }
      score += 1
    } else if (isNegative) {
      score += 1
    }
  }
  return score
}

let normalizedPostsCache: WeakMap<Post, NormalizedPost> = new WeakMap()

function getNormalizedPost(post: Post): NormalizedPost {
  let normalized = normalizedPostsCache.get(post)
  if (!normalized) {
    normalized = normalizePost(post)
    normalizedPostsCache.set(post, normalized)
  }
  return normalized
}

export function searchPosts(posts: Post[], query: string): Post[] {
  const expr = normalizeString(query)
  if (expr === '') {
    return posts
  }

  const scoredPosts: ScoredPost[] = []
  for (const post of posts) {
    const normalized = getNormalizedPost(post)
    const score = scorePost(normalized, expr)
    if (score > 0) {
      scoredPosts.push({ ...normalized, score })
    }
  }

  return scoredPosts.sort((a, b) => b.score - a.score)
}

export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  timeout = 300,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Args) => {
    clearTimeout(timer)
    timer = setTimeout(() => func(...args), timeout)
  }
}
