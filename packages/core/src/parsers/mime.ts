// Single source of truth for feed MIME types, shared by the HTML feed-link parser
// and the content/feed fetchers.

export const RSSMimeTypes = [
  'application/rss+xml',
  'application/x-rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
]

export const JsonFeedMimeTypes = ['application/feed+json', 'application/json']

export const allFeedMimeTypes = [...RSSMimeTypes, ...JsonFeedMimeTypes]

export function isRssMimeType(mimeType: string): boolean {
  return RSSMimeTypes.includes(mimeType)
}

export function isJsonFeedMimeType(mimeType: string): boolean {
  return JsonFeedMimeTypes.includes(mimeType)
}

export function isFeedMimeType(mimeType: string): boolean {
  return isRssMimeType(mimeType) || isJsonFeedMimeType(mimeType)
}
