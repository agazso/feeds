import type { Feed } from '../models/feed'
import { DEFAULT_FAVICON, parseFaviconFromHtml } from '../utils/favicon'
import { HtmlUtils, type ParsedNode } from '../utils/html'
import { type OpenGraphData, getHtmlOpenGraphData } from '../utils/opengraph'
import { createUrlFromUrn } from '../utils/url'
import { getHeadersForUrl } from '../utils/headers'

export interface HtmlMetaData extends OpenGraphData {
  icon: string
  feedUrl: string
  feedTitle: string
  createdAt: number
  updatedAt: number
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

export function parseHtmlMetaData(url: string, html: string, feed?: Feed | null): HtmlMetaData {
  const document = HtmlUtils.parse(html)
  const baseUrl = new URL(url).origin
  const openGraphData = getHtmlOpenGraphData(document, url)
  const feedName = feed ? feed.name : ''
  const name = getFirstNonEmpty([getMetaName(document), openGraphData.name, feedName])
  const title = getHtmlTitle(document, openGraphData.title)
  const favicon = parseFaviconFromHtml(html) || DEFAULT_FAVICON
  const icon = createUrlFromUrn(favicon, baseUrl)
  const createdAt = getPublishedTime(document)
  const updatedAt = getModifiedTime(document, createdAt)

  return {
    ...openGraphData,
    title,
    name,
    icon,
    feedUrl: feed != null ? feed.feedUrl : '',
    feedTitle: feedName,
    createdAt,
    updatedAt,
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

function getFirstNonEmpty(items: string[], defaultValue = ''): string {
  for (const item of items) {
    if (item !== '') {
      return item
    }
  }
  return defaultValue
}
