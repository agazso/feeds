import type { Post } from '@feeds/core'
import { describe, expect, test } from 'vitest'
import { searchPosts } from '../src/lib/search'

// The index buckets every word under its first letter; a post is only reachable
// through that bucket, so a bug there silently drops matches.
function makePost(text: string, extra: Partial<Post> = {}): Post {
  return { _id: text, text, images: [], createdAt: 0, ...extra }
}

const APPLE = makePost('apple pie recipe')
const AVOCADO = makePost('avocado toast')
const BANANA = makePost('banana bread', { tags: ['baking'] })
const AUTHORED = makePost('plain words', {
  author: { name: 'Ada Lovelace', uri: 'https://ada.test/', image: { uri: '' } },
})
const POSTS = [APPLE, AVOCADO, BANANA, AUTHORED]

/** searchPosts returns scored copies, so compare the posts by identity field. */
function ids(posts: Post[]): unknown[] {
  return posts.map((post) => post._id)
}

describe('searchPosts', () => {
  test('finds each word, including ones sharing a first letter', () => {
    expect(ids(searchPosts(POSTS, 'apple'))).toEqual([APPLE._id])
    expect(ids(searchPosts(POSTS, 'avocado'))).toEqual([AVOCADO._id])
    expect(ids(searchPosts(POSTS, 'banana'))).toEqual([BANANA._id])
    // Both 'a' words live in the same bucket; neither may shadow the other.
    expect(ids(searchPosts(POSTS, 'toast'))).toEqual([AVOCADO._id])
  })

  test('matches a word prefix, anchored at the word start', () => {
    expect(ids(searchPosts(POSTS, 'app'))).toEqual([APPLE._id])
    // Mid-word: 'pp' lands in the 'p' bucket, which holds 'pie', not 'apple'.
    expect(searchPosts(POSTS, 'pp')).toEqual([])
  })

  test('ranks a post matching more words first', () => {
    const both = makePost('apple banana')
    expect(ids(searchPosts([APPLE, BANANA, both], 'apple banana'))[0]).toBe(both._id)
  })

  test('searches tags and the author', () => {
    expect(ids(searchPosts(POSTS, 'baking'))).toEqual([BANANA._id])
    expect(ids(searchPosts(POSTS, 'lovelace'))).toEqual([AUTHORED._id])
  })

  test('a leading minus excludes', () => {
    expect(ids(searchPosts(POSTS, '-apple'))).not.toContain(APPLE._id)
  })

  test('an empty query returns the list unchanged', () => {
    expect(searchPosts(POSTS, '')).toBe(POSTS)
  })
})
