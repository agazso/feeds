// Twitter CDN domains that block hotlinking
const HOTLINK_BLOCKED_DOMAINS = ['pbs.twimg.com', 'abs.twimg.com']

// Pre-cached X/Twitter favicon as base64 data URI
const X_FAVICON_URL = 'https://abs.twimg.com/favicons/twitter.3.ico'
const X_FAVICON_BASE64 =
  'data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAB7ElEQVR4Ae1XMZLCMAwUdw0ldJQ8ATpKnkBJByUd8ALyA/gBdJTQUtHS8QT4AaRM5ctmThmfogQ75CYNmhGTbGJr45Vk0yAiQzXaF9VsHwIZAofDgYwxqo9GI/K16/X6cqyxvdVqmdvtZh6PhwmCIHXcw7vdrpFj8ny9XhsYxhe8lwWHw2EycLFYpNh0Ok2w8/nsFHy1WrkE1wnAN5tNMkGv10ux3W6XIab5fD5P3ovldCGrP2Ap4LiW8uRJAcIwe1wpArYU0FJimhQgxaQ9cqX4BZYCgSVmS8HBfRP1JQEsY1xKGSmAcTC+l0QrIWDraicVMBBA4O1265ScpQnAMbkMwphjub1HAI7EkxoDK7n0/gQQGATsCmDMo+z++Hf8E5CjPZ9PiqKIZrMZhWFIl8slxcbjMTWbTTqdTuRrXoz5i2WXRIL+WxWw2+Uml13rnJUT4K9E9nMFaF3SxiojoO1u2rJzl4z3/+oIcHBMLiUp2rDe3ozg+BIYtNee87KjGzLGndPx7JD/0K7xog2Gl30ymaSY1jm9CPhsrXnnBK1zOhHgCWWtF7l2TtA6p3S1E+73exoMBrRcLul4PJKL3e93arfbSUeMA1O/36eYPHU6nWQu7pyaqRlfZnezV05anhSN34va7PPXrHYCP+VaTG3LBV1KAAAAAElFTkSuQmCC'

export function isTwitterCdnUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return HOTLINK_BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))
  } catch {
    return false
  }
}

export function isXUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return (
      hostname === 'x.com' ||
      hostname === 'twitter.com' ||
      hostname.endsWith('.x.com') ||
      hostname.endsWith('.twitter.com')
    )
  } catch {
    return false
  }
}

export function getXFavicon(): string {
  return X_FAVICON_BASE64
}

export async function embedImage(url: string): Promise<string> {
  // Return cached X favicon immediately
  if (url === X_FAVICON_URL) {
    return X_FAVICON_BASE64
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/2.0)',
    },
  })
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  return `data:${contentType};base64,${base64}`
}
