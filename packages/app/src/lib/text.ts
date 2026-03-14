import type { Post } from '@feeds/core'

/**
 * Normalize text for comparison/search: removes accents, special characters,
 * and converts to lowercase
 */
export function normalizeText(s: string | undefined): string {
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

export function postTitle(post: Post): string | undefined {
  if (!post.text.startsWith('**')) {
    return undefined
  }
  return post.text.replaceAll('\n', '').replace(/^\*\*(.*)\*\*(.*)$/, '$1')
}

export function postText(post: Post): string | undefined {
  if (!post.text) {
    return undefined
  }

  return (
    post.text
      // remove bold title
      .replace(/^\*\*.*\*\*/m, '')
      // remove comment links
      .replace(/\[Comments\]\((.*?)\)/gm, '')
      // replace markdown links with just the text
      .replace(/\[(.*?)\]\((.*?)\)/gm, '$1')
      .trim()
  )
}

export function commentLink(post: Post): string | undefined {
  const match = post.text.match(/\[Comments\]\((.*?)\)/m)
  return match?.[1]
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function fixYoutubeThumbnail(src: string): string {
  return src.replace(/hqdefault.jpg$/, 'hq720.jpg')
}

export function makeAbsoluteUrl(url: string | undefined, baseUrl?: string): string | undefined {
  if (!url) {
    return undefined
  }
  if (url.startsWith('http')) {
    return url
  }
  try {
    return new URL(url, baseUrl).href
  } catch {
    return undefined
  }
}

export function thumbnailSrc(post: Post): string | undefined {
  const imageSrc = post.images[0]?.uri
  if (!imageSrc) {
    return undefined
  }
  const absImageSrc = makeAbsoluteUrl(imageSrc, post.link)
  return absImageSrc ? fixYoutubeThumbnail(absImageSrc) : undefined
}
