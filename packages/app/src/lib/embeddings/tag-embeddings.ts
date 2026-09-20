import fs from 'node:fs'
import path from 'node:path'
import type { Feed, Post } from '@feeds/core'
import { dataDir } from '../paths'
import { normalizeText } from '../text'
import { embed, embedBatch } from './embedder'
import { type ScoredItem, rankBySimilarity } from './similarity'

export interface TagEmbedding {
  tag: string
  vector: number[]
  context: string // The text used to generate the embedding
}

export interface TagEmbeddingCache {
  version: number
  embeddings: TagEmbedding[]
}

const CACHE_VERSION = 1
const CACHE_FILE = 'tag-embeddings.json'

/**
 * Get static directory path for cache storage
 */
function getCachePath(user?: string): string {
  return path.join(dataDir(user), CACHE_FILE)
}

/**
 * Build context text for a tag based on how it's used in feeds and posts
 */
export function buildTagContext(tag: string, feeds: Feed[], posts: Post[]): string {
  const contextParts: string[] = [tag]

  // Add names from feeds with this tag
  const taggedFeeds = feeds.filter((f) => f.tags?.includes(tag))
  for (const feed of taggedFeeds.slice(0, 10)) {
    if (feed.name) {
      contextParts.push(feed.name)
    }
  }

  // Add titles/text from posts with this tag
  const taggedPosts = posts.filter((p) => p.tags?.includes(tag))
  for (const post of taggedPosts.slice(0, 10)) {
    if (post.rssItem?.title) {
      contextParts.push(post.rssItem.title)
    }
    if (post.text) {
      contextParts.push(post.text.slice(0, 200))
    }
  }

  return contextParts.join('. ')
}

/**
 * Load tag embeddings from cache file
 */
export function loadTagEmbeddings(user?: string): TagEmbeddingCache | null {
  try {
    const cachePath = getCachePath(user)
    if (!fs.existsSync(cachePath)) {
      return null
    }

    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))

    if (data.version !== CACHE_VERSION) {
      return null // Version mismatch, regenerate
    }

    return data
  } catch {
    return null
  }
}

/**
 * Save tag embeddings to cache file
 */
export function saveTagEmbeddings(cache: TagEmbeddingCache, user?: string): void {
  try {
    const cachePath = getCachePath(user)
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2))
  } catch (e) {
    console.error('Failed to save tag embeddings cache:', e)
  }
}

/**
 * Get embeddings for all tags, using cache when possible
 */
export async function getTagEmbeddings(
  tags: string[],
  feeds: Feed[],
  posts: Post[],
  user?: string,
): Promise<TagEmbedding[]> {
  if (tags.length === 0) return []

  // Try to load from cache
  const cache = loadTagEmbeddings(user)
  const cachedTags = new Map<string, TagEmbedding>()

  if (cache) {
    for (const embedding of cache.embeddings) {
      cachedTags.set(embedding.tag, embedding)
    }
  }

  // Find tags that need new embeddings
  const result: TagEmbedding[] = []
  const tagsToEmbed: Array<{ tag: string; context: string }> = []

  for (const tag of tags) {
    const cached = cachedTags.get(tag)
    if (cached) {
      result.push(cached)
    } else {
      const context = buildTagContext(tag, feeds, posts)
      tagsToEmbed.push({ tag, context })
    }
  }

  // Generate embeddings for missing tags
  if (tagsToEmbed.length > 0) {
    const contexts = tagsToEmbed.map((t) => t.context)
    const vectors = await embedBatch(contexts)

    for (let i = 0; i < tagsToEmbed.length; i++) {
      const embedding: TagEmbedding = {
        tag: tagsToEmbed[i].tag,
        vector: vectors[i],
        context: tagsToEmbed[i].context,
      }
      result.push(embedding)
    }

    // Update cache with all embeddings
    saveTagEmbeddings(
      {
        version: CACHE_VERSION,
        embeddings: result,
      },
      user,
    )
  }

  return result
}

/**
 * Get suggested tags based on semantic similarity to input text
 */
export async function getEmbeddingBasedTags(
  text: string,
  availableTags: string[],
  feeds: Feed[],
  posts: Post[],
  user?: string,
  limit = 5,
  minScore = 0.15,
): Promise<string[]> {
  if (!text || availableTags.length === 0) {
    return []
  }

  try {
    // Normalize text and get embeddings for it
    const normalizedText = normalizeText(text)
    const textVector = await embed(normalizedText)

    // Get embeddings for all available tags
    const tagEmbeddings = await getTagEmbeddings(availableTags, feeds, posts, user)

    // Rank tags by similarity
    const candidates = tagEmbeddings.map((te) => ({
      item: te.tag,
      vector: te.vector,
    }))

    const ranked: ScoredItem<string>[] = rankBySimilarity(textVector, candidates, limit, minScore)

    return ranked.map((r) => r.item)
  } catch (e) {
    console.error('Embedding-based tag suggestion failed:', e)
    return []
  }
}
