import type { Feed } from '../models/feed'
import { DEFAULT_FAVICON, parseFaviconFromHtml } from '../utils/favicon'
import { HtmlUtils, type ParsedNode } from '../utils/html'
import { type OpenGraphData, getHtmlOpenGraphData } from '../utils/opengraph'
import { createUrlFromUrn } from '../utils/url'
import { getHeadersForUrl } from '../utils/headers'

const RSSMimeTypes = [
  'application/rss+xml',
  'application/x-rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
]

const JsonFeedMimeTypes = ['application/feed+json', 'application/json']

export interface HtmlMetaData extends OpenGraphData {
  icon: string
  feedUrl: string
  feedTitle: string
  createdAt: number
  updatedAt: number
  author: string
  siteName: string
}

export async function fetchHtmlMetaDataOnly(
  url: string,
  init?: RequestInit,
): Promise<HtmlMetaData> {
  const headers = init?.headers ?? getHeadersForUrl(url)
  const response = await fetch(url, { ...init, headers })
  const html = await response.text()
  return parseHtmlMetaData(url, html)
}

export function parseFeedUrlFromHtml(html: string, baseUrl: string): string {
  const document = HtmlUtils.parse(html)
  const links = HtmlUtils.findPath(document, ['html', 'head', 'link'])
  const allFeedMimeTypes = [...RSSMimeTypes, ...JsonFeedMimeTypes]

  for (const link of links) {
    if (!HtmlUtils.matchAttributes(link, [{ name: 'rel', value: 'alternate' }])) {
      continue
    }
    for (const mimeType of allFeedMimeTypes) {
      if (HtmlUtils.matchAttributes(link, [{ name: 'type', value: mimeType }])) {
        const feedUrl = HtmlUtils.getAttribute(link, 'href') || ''
        if (feedUrl !== '') {
          return createUrlFromUrn(feedUrl, baseUrl)
        }
      }
    }
  }
  return ''
}

export function parseHtmlMetaData(url: string, html: string, feed?: Feed | null): HtmlMetaData {
  const document = HtmlUtils.parse(html)
  const baseUrl = new URL(url).origin
  const openGraphData = getHtmlOpenGraphData(document, url)
  const feedName = feed ? feed.name : ''
  const name = getFirstNonEmpty([getMetaName(document), openGraphData.name, feedName])
  // Fallback chain: og:site_name → JSON-LD publisher → twitter:site
  const siteName = getFirstNonEmpty([
    openGraphData.siteName,
    getPublisherFromJsonLd(document),
    getTwitterSite(document),
  ])
  const title = getHtmlTitle(document, openGraphData.title)
  const favicon = parseFaviconFromHtml(html) || DEFAULT_FAVICON
  const icon = createUrlFromUrn(favicon, baseUrl)
  const createdAt = getPublishedTime(document)
  const updatedAt = getModifiedTime(document, createdAt)
  // Detect feed URL from HTML if not provided via Feed object
  const detectedFeedUrl = feed?.feedUrl || parseFeedUrlFromHtml(html, baseUrl)

  return {
    ...openGraphData,
    title,
    name,
    siteName,
    icon,
    feedUrl: detectedFeedUrl,
    feedTitle: feedName,
    createdAt,
    updatedAt,
    author: getArticleAuthor(document),
  }
}

interface HtmlChildNode {
  value?: string
}

function getHtmlTitle(document: ParsedNode, defaultTitle: string): string {
  const htmlTitleNodes = HtmlUtils.findPath(document, ['html', 'head', 'title'])
  const firstTitleNode = htmlTitleNodes[0]
  const childNode = firstTitleNode?.childNodes?.[0] as HtmlChildNode | undefined
  const htmlTitle = childNode?.value
  if (htmlTitle) {
    return htmlTitle
  }

  return defaultTitle
}

function getMetaName(document: ParsedNode, defaultValue = ''): string {
  const metaNodes = HtmlUtils.findPath(document, ['html', 'head', 'meta'])
  for (const meta of metaNodes) {
    if (
      HtmlUtils.matchAttributes(meta, [{ name: 'property', value: 'al:iphone:app_name' }]) ||
      HtmlUtils.matchAttributes(meta, [{ name: 'property', value: 'al:android:app_name' }]) ||
      HtmlUtils.matchAttributes(meta, [{ name: 'name', value: 'twitter:app:name:googleplay' }]) ||
      HtmlUtils.matchAttributes(meta, [{ name: 'name', value: 'apple-mobile-web-app-title' }]) ||
      HtmlUtils.matchAttributes(meta, [{ name: 'name', value: 'application-name' }])
    ) {
      const content = HtmlUtils.getAttribute(meta, 'content')
      if (content != null) {
        return content
      }
    }
  }
  return defaultValue
}

function getPublishedTime(document: ParsedNode): number {
  const metaNodes = HtmlUtils.findPath(document, ['html', 'head', 'meta'])
  for (const meta of metaNodes) {
    if (
      HtmlUtils.matchAttributes(meta, [{ name: 'property', value: 'article:published' }]) ||
      HtmlUtils.matchAttributes(meta, [{ name: 'property', value: 'article:published_time' }])
    ) {
      const content = HtmlUtils.getAttribute(meta, 'content')
      if (content != null) {
        return Date.parse(content)
      }
    }
  }
  return 0
}

function getModifiedTime(document: ParsedNode, defaultTime: number): number {
  const metaNodes = HtmlUtils.findPath(document, ['html', 'head', 'meta'])
  for (const meta of metaNodes) {
    if (
      HtmlUtils.matchAttributes(meta, [{ name: 'property', value: 'article:modified' }]) ||
      HtmlUtils.matchAttributes(meta, [{ name: 'property', value: 'article:modified_time' }])
    ) {
      const content = HtmlUtils.getAttribute(meta, 'content')
      if (content != null) {
        return Date.parse(content)
      }
    }
  }
  return defaultTime
}

function getArticleAuthor(document: ParsedNode): string {
  const metaNodes = HtmlUtils.findPath(document, ['html', 'head', 'meta'])
  for (const meta of metaNodes) {
    if (
      HtmlUtils.matchAttributes(meta, [{ name: 'property', value: 'article:author' }]) ||
      HtmlUtils.matchAttributes(meta, [{ name: 'name', value: 'author' }])
    ) {
      const content = HtmlUtils.getAttribute(meta, 'content')
      if (content != null) {
        return content
      }
    }
  }
  // Fallback to JSON-LD
  return getArticleAuthorFromJsonLd(document)
}

function getArticleAuthorFromJsonLd(document: ParsedNode): string {
  const scriptNodes = HtmlUtils.findPath(document, ['html', 'head', 'script'])
  for (const script of scriptNodes) {
    if (!HtmlUtils.matchAttributes(script, [{ name: 'type', value: 'application/ld+json' }])) {
      continue
    }
    const content = script.childNodes[0]?.value
    if (!content) continue

    try {
      const data = JSON.parse(content)
      // Handle both single object and @graph array
      const items = Array.isArray(data['@graph']) ? data['@graph'] : [data]
      for (const item of items) {
        const type = item['@type']
        if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting') {
          const author = item.author
          if (typeof author === 'string') return author
          if (author?.name) return author.name
          if (Array.isArray(author) && author[0]?.name) return author[0].name
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  return ''
}

function getPublisherFromJsonLd(document: ParsedNode): string {
  const scriptNodes = HtmlUtils.findPath(document, ['html', 'head', 'script'])
  for (const script of scriptNodes) {
    if (!HtmlUtils.matchAttributes(script, [{ name: 'type', value: 'application/ld+json' }])) {
      continue
    }
    const content = script.childNodes[0]?.value
    if (!content) continue

    try {
      const data = JSON.parse(content)
      // Handle both single object and @graph array
      const items = Array.isArray(data['@graph']) ? data['@graph'] : [data]
      for (const item of items) {
        const type = item['@type']
        if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting' || type === 'WebPage') {
          const publisher = item.publisher
          if (typeof publisher === 'string') return publisher
          if (publisher?.name) return publisher.name
        }
        // Also check Organization type at root level
        if (type === 'Organization' && item.name) {
          return item.name
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  return ''
}

function getTwitterSite(document: ParsedNode): string {
  const metaNodes = HtmlUtils.findPath(document, ['html', 'head', 'meta'])
  for (const meta of metaNodes) {
    if (HtmlUtils.matchAttributes(meta, [{ name: 'name', value: 'twitter:site' }])) {
      const content = HtmlUtils.getAttribute(meta, 'content')
      if (content) {
        // Remove @ prefix if present (e.g., "@sitename" -> "sitename")
        return content.startsWith('@') ? content.slice(1) : content
      }
    }
  }
  return ''
}

function getFirstNonEmpty(items: string[], defaultValue = ''): string {
  for (const item of items) {
    if (item !== '') {
      return item
    }
  }
  return defaultValue
}
