export const REDDIT_COM = 'reddit.com'
export const TWITTER_COM = 'twitter.com'
export const X_COM = 'x.com'

const HTTP_URL_MATCHER = /(http.?:\/\/.*?)( |$)/

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']

export function isXUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return (
      hostname === X_COM ||
      hostname === TWITTER_COM ||
      hostname.endsWith('.' + X_COM) ||
      hostname.endsWith('.' + TWITTER_COM)
    )
  } catch {
    return false
  }
}

export function isRedditUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return hostname === REDDIT_COM || hostname.endsWith('.' + REDDIT_COM)
  } catch {
    return false
  }
}

export function isYoutubeUrl(url: string): boolean {
  return getHumanHostname(getCanonicalUrl(url)) === 'youtube.com'
}

export function isImageUrl(url: string): boolean {
  const lowercaseUrl = url.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lowercaseUrl.includes(ext))
}

export function getHumanHostname(url: string): string {
  if (!url) {
    return ''
  }
  if (typeof url.startsWith !== 'function') {
    return ''
  }
  if (url.startsWith('//')) {
    url = 'https:' + url
  }
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname
    const parts = hostname ? hostname.split('.') : []
    const humanHostname = parts.slice(-2)?.join('.') ?? ''
    return humanHostname
  } catch {
    return ''
  }
}

export function createUrlFromUrn(urn: string, baseUrl: string): string {
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/'
  }
  if (urn.startsWith('//')) {
    const parts = baseUrl.split(':', 2)
    const protocol = parts.length > 1 ? parts[0] : 'https'
    return protocol + ':' + urn
  }
  if (urn.startsWith('http')) {
    return urn
  }
  if (urn.startsWith('/')) {
    return baseUrl + urn.slice(1)
  }
  return baseUrl + urn
}

export function getBaseUrl(url: string): string {
  if (url.startsWith('//')) {
    url = 'https:' + url
  }

  return url.replace(/(http.?:\/\/.*?)[\/\?].*/, '$1/')
}

export function getCanonicalUrl(url: string): string {
  if (url === '') {
    return ''
  }
  const queryParts = url.split('?', 2)
  if (queryParts.length !== 1) {
    url = queryParts[0] ?? ''
  }
  const parts = url.split('//', 2)
  if (parts.length === 1) {
    if (!url.includes('/')) {
      url += '/'
    }
  } else if (parts.length > 1) {
    if (!parts[1]?.includes('/')) {
      url += '/'
    }
  }
  if (url.startsWith('//')) {
    url = 'https:' + url
  }
  if (!url.startsWith('http')) {
    url = 'https://' + url
  }
  return url
}

export function getHttpsUrl(url: string): string {
  const httpProtocol = 'http:'
  if (url.startsWith(httpProtocol)) {
    return 'https:' + url.slice(httpProtocol.length)
  }
  return url
}

export function stripNonAscii(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, '')
}

export function getLinkFromText(text: string): string | undefined {
  const httpLink = getHttpLinkFromText(text)
  if (httpLink != null) {
    return httpLink
  }
  return undefined
}

export function getHttpLinkFromText(text: string): string | undefined {
  const httpLink = text.match(HTTP_URL_MATCHER)
  if (httpLink != null) {
    return httpLink[1]
  }
  return undefined
}

export function compareUrls(url1: string, url2: string): boolean {
  const canonicalUrl1 = getCanonicalUrl(url1)
  const canonicalUrl2 = getCanonicalUrl(url2)
  if (canonicalUrl1 === canonicalUrl2) {
    return true
  }

  try {
    const parsedUrl1 = new URL(canonicalUrl1)
    const parsedUrl2 = new URL(canonicalUrl2)
    const hostname1 = parsedUrl1.hostname
    const hostname2 = parsedUrl2.hostname
    const wwwPrefix = 'www.'
    const stripWWWPrefix = (hostname: string) =>
      hostname.startsWith(wwwPrefix) ? hostname.slice(wwwPrefix.length) : hostname

    const hostname1WithoutWWW = stripWWWPrefix(hostname1)
    const hostname2WithoutWWW = stripWWWPrefix(hostname2)

    return hostname1WithoutWWW === hostname2WithoutWWW
  } catch {
    return false
  }
}

/**
 * Normalize a user-entered URL to a valid URL.
 * Handles missing protocols, spaces, etc.
 * Preserves query parameters (unlike getCanonicalUrl which strips them).
 * Returns null if the input cannot be normalized to a valid URL.
 */
export function normalizeUrl(input: string): string | null {
  if (!input || typeof input !== 'string') return null

  let url = input.trim()
  if (!url) return null

  // Add protocol if missing
  if (url.startsWith('//')) {
    url = 'https:' + url
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }

  // Add trailing slash to bare domains (no path)
  try {
    const parsed = new URL(url)
    if (parsed.pathname === '' || (parsed.pathname === '/' && !url.endsWith('/'))) {
      // Only add slash if there's no query string and URL doesn't have one
      if (!parsed.search && !url.includes('?')) {
        url = parsed.origin + '/'
      }
    }
    return url
  } catch {
    return null
  }
}
