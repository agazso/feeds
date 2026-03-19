import he from 'he'
import type { Feed } from '../models/feed'
import type { ImageData } from '../models/image-data'
import type { Post } from '../models/post'
import type { RSSEnclosure, RSSFeed, RSSFeedWithMetrics, RSSMedia } from '../models/rss'
import { MINUTE } from '../utils/date'
import { DEFAULT_FAVICON, findBestIconFromLinks, parseFaviconFromHtml } from '../utils/favicon'
import { safeFetch } from '../utils/fetch'
import { HEADERS_WITH_CURL, HEADERS_WITH_FELFELE, HEADERS_WITH_WHATSAPP } from '../utils/headers'
import { HtmlUtils, type ParsedNode } from '../utils/html'
import * as urlUtils from '../utils/url'
import { parseHtmlMetaData } from './html-metadata'
import { fetchFeed, loadRSSFeed } from './rss'

export interface ContentWithMimeType {
  content: string
  mimeType: string
}

const RSSMimeTypes = [
  'application/rss+xml',
  'application/x-rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
]

const JsonFeedMimeTypes = ['application/feed+json', 'application/json']

export const altFeedLocations = [
  '/rss',
  '/rss/',
  '/rss.xml',
  '/rss/index.rss',
  '/feed',
  '/social-media/feed/',
  '/feed/',
  '/feed/rss/',
  '/index.xml',
  '/',
]

function getFeedUrlFromHtmlLink(link: ParsedNode): string {
  const allFeedMimeTypes = [...RSSMimeTypes, ...JsonFeedMimeTypes]
  for (const mimeType of allFeedMimeTypes) {
    const matcher = [{ name: 'type', value: mimeType }]
    if (HtmlUtils.matchAttributes(link, matcher)) {
      const feedUrl = HtmlUtils.getAttribute(link, 'href') || ''
      if (feedUrl !== '') {
        return feedUrl
      }
    }
  }
  return ''
}

function parseFeedFromHtml(html: string): Feed {
  const feed: Feed = {
    name: '',
    url: '',
    feedUrl: '',
    favicon: '',
  }

  const document = HtmlUtils.parse(html)
  const links = HtmlUtils.findPath(document, ['html', 'head', 'link'])

  for (const link of links) {
    if (
      feed.feedUrl === '' &&
      HtmlUtils.matchAttributes(link, [{ name: 'rel', value: 'alternate' }])
    ) {
      const feedUrl = getFeedUrlFromHtmlLink(link)
      if (feedUrl !== '') {
        feed.feedUrl = feedUrl
        break
      }
    }
  }

  feed.favicon = findBestIconFromLinks(links) || ''

  return feed
}

export interface ContentResult {
  content: string
  mimeType: string
  url: string
}

export async function fetchContentResult(url: string): Promise<ContentResult | null> {
  if (url.startsWith('http://')) {
    const urlHTTPS = url.replace('http://', 'https://')
    const contentWithMimeTypeHTTPS = await fetchContentWithMimeType(urlHTTPS)
    if (contentWithMimeTypeHTTPS != null) {
      return {
        content: contentWithMimeTypeHTTPS.content,
        mimeType: contentWithMimeTypeHTTPS.mimeType,
        url: urlHTTPS,
      }
    }
  }
  const contentWithMimeType = await fetchContentWithMimeType(url)
  return contentWithMimeType == null
    ? null
    : {
        content: contentWithMimeType.content,
        mimeType: contentWithMimeType.mimeType,
        url,
      }
}

export function parseMimeType(contentType: string): string {
  const parts = contentType.split(';', 2)
  const mimeType = parts.length > 1 ? (parts[0] ?? contentType) : contentType
  return mimeType
}

export async function fetchContentWithMimeType(url: string): Promise<ContentWithMimeType | null> {
  const isRedditUrl = urlUtils.getHumanHostname(url) === urlUtils.REDDIT_COM

  try {
    const response = await safeFetch(url, {
      headers: {
        ...(isRedditUrl ? HEADERS_WITH_FELFELE : HEADERS_WITH_CURL),
        ...(url.startsWith('https://cointelegraph.com')
          ? HEADERS_WITH_WHATSAPP
          : HEADERS_WITH_CURL),
      },
    })

    const contentType = response.headers.get('Content-Type')
    if (!contentType) {
      return null
    }

    const mimeType = parseMimeType(contentType)
    const content = await response.text()

    return {
      content: content,
      mimeType: mimeType,
    }
  } catch {
    return null
  }
}

export function getFeedFromHtml(baseUrl: string, html: string): Feed {
  const feed = parseFeedFromHtml(html)
  if (feed.feedUrl !== '') {
    feed.feedUrl = urlUtils.createUrlFromUrn(feed.feedUrl, baseUrl)
  }
  if (typeof feed.favicon === 'string' && feed.favicon !== '') {
    feed.favicon = urlUtils.createUrlFromUrn(feed.favicon, baseUrl)
  }

  const regex = new RegExp(/ - .*/g)
  feed.name = feed.name.replace(regex, '').replaceAll('\n', '').trim()

  feed.url = baseUrl
  return feed
}

export function isRssMimeType(mimeType: string): boolean {
  return RSSMimeTypes.includes(mimeType)
}

export function isJsonFeedMimeType(mimeType: string): boolean {
  return JsonFeedMimeTypes.includes(mimeType)
}

export function isFeedMimeType(mimeType: string): boolean {
  return isRssMimeType(mimeType) || isJsonFeedMimeType(mimeType)
}

export async function fetchRSSFeedUrlFromUrl(url: string): Promise<ContentWithMimeType | null> {
  const contentWithMimeType = await fetchContentWithMimeType(url)
  if (!contentWithMimeType) {
    return null
  }

  if (isRssMimeType(contentWithMimeType.mimeType)) {
    return contentWithMimeType
  }

  return null
}

export async function discoverFeedUrlFromWellKnownPaths(baseUrl: string): Promise<string> {
  for (const path of altFeedLocations) {
    const url = urlUtils.createUrlFromUrn(path, baseUrl)
    const result = await fetchRSSFeedUrlFromUrl(url)
    if (result && isRssMimeType(result.mimeType)) {
      return url
    }
  }
  return ''
}

async function tryFetchFeedFromAltLocations(baseUrl: string, feed: Feed): Promise<Feed | null> {
  for (const altFeedLocation of altFeedLocations) {
    const altUrl = urlUtils.createUrlFromUrn(altFeedLocation, baseUrl)
    const rssContentWithMimeType = await fetchRSSFeedUrlFromUrl(altUrl)
    if (rssContentWithMimeType != null && isRssMimeType(rssContentWithMimeType.mimeType)) {
      feed.feedUrl = altUrl
      try {
        const rssFeed = await loadRSSFeed(altUrl, rssContentWithMimeType.content)
        return {
          ...feed,
          name: rssFeed.feed.title === '' ? feed.name : rssFeed.feed.title,
        }
      } catch {
        continue
      }
    }
  }
  return null
}

function normalizeName(name: string): string {
  const separator = ' - '
  if (name.includes(separator)) {
    return name.split(separator)[0] ?? name
  }
  return name
}

export async function augmentFeedWithMetadata(
  url: string,
  feedName: string,
  rssFeed: RSSFeedWithMetrics,
  html?: string,
): Promise<Feed | null> {
  const channelLink = (rssFeed.feed && rssFeed.feed.url) || undefined
  // Use RSS channel link directly if available (preserves author path for multi-author platforms)
  // Fall back to getBaseUrl() only when channel link is not available
  const baseUrl = channelLink
    ? urlUtils.getCanonicalUrl(channelLink).replace('http://', 'https://')
    : urlUtils.getBaseUrl(url).replace('http://', 'https://')
  const name = normalizeName(feedName || rssFeed.feed.title)
  const feed: Feed = {
    url: urlUtils.getCanonicalUrl(baseUrl),
    feedUrl: url,
    name: name,
    favicon: rssFeed.feed.icon || '',
  }
  // Fetch the website to augment the feed data with favicon and title
  if (!html) {
    const contentWithMimeType = await fetchContentWithMimeType(baseUrl)
    if (contentWithMimeType == null) {
      return null
    }
    html = contentWithMimeType.content
  }
  const feedFromHtml = getFeedFromHtml(baseUrl, html)
  if (feed.name === '') {
    feed.name = feedFromHtml.name
  }
  feed.favicon = feedFromHtml.favicon || rssFeed.feed.icon || ''
  if (feed.favicon === '') {
    const feedFavicon = parseFaviconFromHtml(html)
    if (feedFavicon != null) {
      feed.favicon = urlUtils.createUrlFromUrn(feedFavicon, baseUrl)
    } else {
      const metadata = parseHtmlMetaData(baseUrl, html, feed)
      feed.favicon = metadata.image
    }

    if (feed.favicon === '') {
      feed.favicon = urlUtils.createUrlFromUrn(DEFAULT_FAVICON, baseUrl)
    }
  }
  return feed
}

export async function fetchFeedFromUrl(url: string): Promise<Feed | null> {
  const contentResult = await fetchContentResult(url)
  if (!contentResult) {
    return null
  }
  return await fetchFeedByContentWithMimeType(contentResult.url, contentResult)
}

export async function fetchFeedByContentWithMimeType(
  url: string,
  contentWithMimeType: ContentWithMimeType,
): Promise<Feed | null> {
  if (contentWithMimeType.mimeType === 'text/html') {
    const baseUrl = urlUtils.getBaseUrl(url).replace('http://', 'https://')
    const feed = getFeedFromHtml(baseUrl, contentWithMimeType.content)
    if (feed.feedUrl !== '') {
      const rssFeed = await fetchFeed(feed.feedUrl)
      const augmentedFeed = await augmentFeedWithMetadata(
        feed.feedUrl,
        feed.name,
        rssFeed,
        contentWithMimeType.content,
      )
      if (augmentedFeed != null) {
        return augmentedFeed
      }
    }

    const altFeed = await tryFetchFeedFromAltLocations(baseUrl, feed)
    if (altFeed != null && altFeed.feedUrl !== '') {
      const rssFeed = await fetchFeed(altFeed.feedUrl)
      const augmentedFeed = await augmentFeedWithMetadata(
        feed.feedUrl,
        feed.name,
        rssFeed,
        contentWithMimeType.content,
      )
      if (augmentedFeed != null) {
        return augmentedFeed
      }
    }
  }

  if (isFeedMimeType(contentWithMimeType.mimeType)) {
    const rssFeed = await loadRSSFeed(url, contentWithMimeType.content)
    const augmentedFeed = await augmentFeedWithMetadata(url, '', rssFeed)
    if (augmentedFeed != null) {
      return augmentedFeed
    }
  }

  return null
}

function feedFaviconString(favicon: string | number): string {
  return typeof favicon === 'string' ? favicon : ''
}

export async function loadPosts(storedFeeds: Feed[]): Promise<Post[]> {
  const posts: Post[] = []

  const feedMap: { [index: string]: Feed } = {}
  for (const feed of storedFeeds) {
    feedMap[feed.feedUrl] = feed
  }

  const fetchFeedPromises = storedFeeds.map((feed) => tryFetchFeed(feed.feedUrl))
  const feeds = await Promise.all(fetchFeedPromises)
  for (const feedWithMetrics of feeds) {
    if (feedWithMetrics) {
      try {
        const rssFeed = feedWithMetrics.feed
        const favicon = feedMap[feedWithMetrics.url]?.favicon
        const faviconString = feedFaviconString(favicon ?? '')
        const feedName = feedMap[feedWithMetrics.url]?.name || feedWithMetrics.feed.title
        const tags = feedMap[feedWithMetrics.url]?.tags
        const convertedPosts = convertRSSFeedtoPosts(
          rssFeed,
          feedName,
          faviconString,
          feedWithMetrics.url,
          tags,
        )
        posts.push.apply(posts, convertedPosts)
      } catch {
        // Error parsing feed
      }
    }
  }
  return posts
}

function htmlImageReplacer(match: string, p1: string) {
  if (p1.startsWith('https://a.fsdn.com/')) {
    return ''
  }
  return `![](${p1})`
}

export function htmlToMarkdown(description: string): string {
  const strippedHtml = description
    .replace(/^( *)/gm, '')
    .replace(/\n/gm, '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gm, '$1')
    .replace(/<a.*?href=['"](.*?)['"].*?>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img.*?src=['"](.*?)['"].*?>/gi, htmlImageReplacer)
    .replace(/<p.*?>/gi, '\n\n')
    .replace(/<(\/?[a-z]+.*?>)/gi, '')
    .replace(/<!--.*?-->/g, '')
    .replace(/ +/g, ' ')

  const decoded = he.decode(strippedHtml)
  return decoded
}

export function extractTextAndImagesFromMarkdown(
  markdown: string,
  baseUri: string,
): [string, ImageData[]] {
  const images: ImageData[] = []
  const text = markdown.replace(/(\!\[\]\(.*?\))/gi, (uri) => {
    const image: ImageData = {
      uri:
        baseUri +
        uri.replace('!', '').replace('[', '').replace(']', '').replace('(', '').replace(')', ''),
    }
    images.push(image)
    return ''
  })
  return [text, images]
}

function stringEquals(a: string, b: string): boolean {
  for (let i = 0; i < a.length; i++) {
    if (i >= b.length) {
      return false
    }
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

export function isTitleSameAsText(title: string, text: string): boolean {
  const replacedText = urlUtils.stripNonAscii(text.replace(/\[(.*?)\]\(.*?\)/g, '$1').trim())
  const trimmedTitle = urlUtils.stripNonAscii(title.trim())
  const isSame = stringEquals(trimmedTitle, replacedText)
  return isSame
}

async function tryFetchFeed(feedUrl: string): Promise<RSSFeedWithMetrics | null> {
  try {
    const rss = await fetchFeed(feedUrl)
    return rss
  } catch {
    return null
  }
}

function stripTrailing(s: string, trail: string): string {
  if (s.endsWith(trail)) {
    return s.substring(0, s.length - trail.length)
  }
  return s
}

function convertRSSFeedtoPosts(
  rssFeed: RSSFeed,
  feedName: string,
  favicon: string,
  feedUrl: string,
  tags?: string[],
): Post[] {
  const links: Set<string> = new Set()
  const strippedFavicon = stripTrailing(favicon, '/')
  const now = Date.now()
  const adjustCreatedAt = (createdAt: number) => (createdAt > now ? now - 30 * MINUTE : createdAt)
  const posts = rssFeed.items
    .map((item) => {
      try {
        const markdown = htmlToMarkdown(item.description)
        const contentMarkdown = item.content && htmlToMarkdown(item.content)
        const [text, markdownImages] = extractTextAndImagesFromMarkdown(markdown, '')
        const mediaImages = extractImagesFromMedia(item.media)
        const enclosureImages = extractImagesFromEnclosures(item.enclosures)
        const [, contentImages] = contentMarkdown
          ? extractTextAndImagesFromMarkdown(contentMarkdown, '')
          : [undefined, undefined]
        const images = markdownImages
          .concat(mediaImages)
          .concat(markdownImages.length === 0 ? enclosureImages : [])
          .concat(contentImages ? contentImages : [])
        const title = isTitleSameAsText(item.title, text)
          ? ''
          : item.title === '(Untitled)'
            ? ''
            : '**' + htmlToMarkdown(item.title || '') + '**' + '\n\n'
        const commentsLink = item.comments ? `\n\n[Comments](${item.comments})` : ''

        const post: Post = {
          _id: feedUrl + '/' + item.link,
          text: (title + text + commentsLink).trim(),
          createdAt: adjustCreatedAt(item.created),
          images,
          link: item.link,
          feedUrl,
          author: {
            name: feedName,
            uri: feedUrl,
            image: {
              uri: strippedFavicon,
            },
          },
          rssItem: item,
          tags,
        }
        return post
      } catch {
        return undefined
      }
    })
    .filter((post) => {
      if (post == null) {
        return false
      }
      if (post.link != null && links.has(post.link)) {
        return false
      }
      if (post.text === '') {
        return false
      }
      if (post.link != null) {
        links.add(post.link)
      }

      return true
    })

  return posts as Post[]
}

function extractImagesFromMedia(media?: RSSMedia): ImageData[] {
  if (media == null || media.thumbnail == null) {
    return []
  }
  const images = media.thumbnail.map(
    (thumbnail) =>
      ({
        uri: thumbnail.url[0],
        width: thumbnail.width?.[0],
        height: thumbnail.height?.[0],
      }) as ImageData,
  )
  return images
}

function isSupportedImageType(type: string): boolean {
  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png') {
    return true
  }
  return false
}

function extractImagesFromEnclosures(enclosures?: RSSEnclosure[]): ImageData[] {
  if (enclosures == null) {
    return []
  }
  const images = enclosures
    .filter((enclosure) => isSupportedImageType(enclosure.type))
    .map((enclosure) => ({ uri: enclosure.url }))

  return images
}
