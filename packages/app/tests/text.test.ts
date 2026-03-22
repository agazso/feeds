import { describe, expect, test } from 'vitest'
import { postTitle, postText } from '../src/lib/text'
import type { Post } from '@feeds/core'

function makePost(text: string): Post {
  return { _id: 'test', text, images: [], createdAt: Date.now() }
}

describe('postTitle', () => {
  test('extracts title from markdown formatted text', () => {
    const post = makePost('**My Title**\n\nSome description')
    expect(postTitle(post)).toBe('My Title')
  })

  test('returns undefined when text does not start with **', () => {
    const post = makePost('Plain text without title')
    expect(postTitle(post)).toBeUndefined()
  })

  test('handles title with description containing **bold** text', () => {
    const post = makePost('**My Title**\n\nDescription with **bold** word')
    expect(postTitle(post)).toBe('My Title')
  })

  test('handles empty description', () => {
    const post = makePost('**Just Title**')
    expect(postTitle(post)).toBe('Just Title')
  })
})

describe('postText', () => {
  test('extracts body text without title', () => {
    const post = makePost('**My Title**\n\nSome description')
    expect(postText(post)).toBe('Some description')
  })

  test('removes comment links', () => {
    const post = makePost('**Title**\n\nDesc\n\n[Comments](https://example.com)')
    expect(postText(post)).toBe('Desc')
  })

  test('handles body containing **bold** markdown', () => {
    const post = makePost('**My Title**\n\n**Note:** Important text')
    expect(postText(post)).toBe('**Note:** Important text')
  })
})
