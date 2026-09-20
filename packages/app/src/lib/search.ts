import type { Post } from '@feeds/core'
import { getHumanHostname } from '@feeds/core'
import { normalizeText } from './text'

interface NormalizedPost extends Post {
  index: Record<string, string>
}

interface ScoredPost extends NormalizedPost {
  score: number
}

function normalizePost(post: Post): NormalizedPost {
  const authorName = post.author?.name ? normalizeText(post.author.name) : ''
  const authorUrl = post.author?.uri ? getHumanHostname(post.author.uri) : ''
  const text = normalizeText(post.text)
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
  // Bucket each word under its first letter. Built by mutation: the spread this
  // replaced copied the whole index once per word, for every post.
  const index: Record<string, string> = {}
  for (const word of textSet) {
    const letter = word[0]
    index[letter] = index[letter] ? `${index[letter]} ${word}` : ` ${word}`
  }

  return { ...post, index }
}

function scorePost(post: NormalizedPost, expr: string): number {
  const words = expr.split(' ').filter((word) => word !== '')
  let score = 0
  for (const word of words) {
    const isNegative = word.startsWith('-')
    const searchTerm = isNegative ? word.slice(1) : word
    const matched = post.index[searchTerm[0]]?.includes(` ${searchTerm}`)
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

const normalizedPostsCache: WeakMap<Post, NormalizedPost> = new WeakMap()

function getNormalizedPost(post: Post): NormalizedPost {
  let normalized = normalizedPostsCache.get(post)
  if (!normalized) {
    normalized = normalizePost(post)
    normalizedPostsCache.set(post, normalized)
  }
  return normalized
}

export function searchPosts(posts: Post[], query: string): Post[] {
  const expr = normalizeText(query)
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
