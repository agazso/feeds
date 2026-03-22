import type { Post } from './models/post'
import { isXUrl, isRedditUrl } from './utils/url'

// Pre-cached X/Twitter favicon as base64 data URI
const X_FAVICON_BASE64 =
  'data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAB7ElEQVR4Ae1XMZLCMAwUdw0ldJQ8ATpKnkBJByUd8ALyA/gBdJTQUtHS8QT4AaRM5ctmThmfogQ75CYNmhGTbGJr45Vk0yAiQzXaF9VsHwIZAofDgYwxqo9GI/K16/X6cqyxvdVqmdvtZh6PhwmCIHXcw7vdrpFj8ny9XhsYxhe8lwWHw2EycLFYpNh0Ok2w8/nsFHy1WrkE1wnAN5tNMkGv10ux3W6XIab5fD5P3ovldCGrP2Ap4LiW8uRJAcIwe1wpArYU0FJimhQgxaQ9cqX4BZYCgSVmS8HBfRP1JQEsY1xKGSmAcTC+l0QrIWDraicVMBBA4O1265ScpQnAMbkMwphjub1HAI7EkxoDK7n0/gQQGATsCmDMo+z++Hf8E5CjPZ9PiqKIZrMZhWFIl8slxcbjMTWbTTqdTuRrXoz5i2WXRIL+WxWw2+Uml13rnJUT4K9E9nMFaF3SxiojoO1u2rJzl4z3/+oIcHBMLiUp2rDe3ozg+BIYtNee87KjGzLGndPx7JD/0K7xog2Gl30ymaSY1jm9CPhsrXnnBK1zOhHgCWWtF7l2TtA6p3S1E+73exoMBrRcLul4PJKL3e93arfbSUeMA1O/36eYPHU6nWQu7pyaqRlfZnezV05anhSN34va7PPXrHYCP+VaTG3LBV1KAAAAAElFTkSuQmCC'

// Pre-cached Reddit favicon as base64 data URI
const REDDIT_FAVICON_BASE64 =
  'data:image/png;base64,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'

function getXFavicon(): string {
  return X_FAVICON_BASE64
}

function getRedditFavicon(): string {
  return REDDIT_FAVICON_BASE64
}

/**
 * Get the appropriate favicon for a URL, handling hotlink-blocked sites.
 * Use this for API responses where we need to return a displayable icon.
 */
export function getFaviconForUrl(url: string, originalIcon?: string): string | undefined {
  if (isXUrl(url)) {
    return getXFavicon()
  }
  if (isRedditUrl(url)) {
    return getRedditFavicon()
  }
  return originalIcon
}

/**
 * Transform post images for display.
 * Handles author favicons for X/Twitter and Reddit posts.
 */
export async function transformPostImages(post: Post, url: string): Promise<Post> {
  // Use hardcoded favicon for X/Twitter URLs
  if (isXUrl(url) && post.author) {
    post = {
      ...post,
      author: {
        name: post.author.name,
        uri: post.author.uri,
        image: { uri: getXFavicon() },
      },
    }
  }

  // Use hardcoded favicon for Reddit URLs
  if (isRedditUrl(url) && post.author) {
    post = {
      ...post,
      author: {
        name: post.author.name,
        uri: post.author.uri,
        image: { uri: getRedditFavicon() },
      },
    }
  }

  return post
}
