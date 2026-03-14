import { XMLParser } from 'fast-xml-parser'
import type { RSSFeed, RSSFeedWithMetrics, RSSItem } from '../models/rss'
import { safeFetch } from '../utils/fetch'
import { HEADERS_WITH_CURL, HEADERS_WITH_FELFELE } from '../utils/headers'
import { timeout } from '../utils/timeout'
import * as urlUtils from '../utils/url'
import { parseAtomFeed } from './atom'
import { isJsonFeed, parseJsonFeed } from './json-feed'

const FEED_FETCH_TIMEOUT = 15000

function redditJsonFeedUrl(url: string): string {
  if (url.endsWith('.rss')) {
    return url.slice(0, -4) + '.json'
  }
  if (url.endsWith('.json')) {
    return url
  }
  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  return canonicalUrl.endsWith('/') ? canonicalUrl + '.json' : canonicalUrl + '/.json'
}

async function fetchResponse(
  fetchUrl: string,
  headers: RequestInit,
): Promise<{ response: Response; feedUrl: string }> {
  if (fetchUrl.startsWith('http://')) {
    try {
      fetchUrl = fetchUrl.replace('http://', 'https://')
      return {
        response: await timeout(FEED_FETCH_TIMEOUT, safeFetch(fetchUrl, headers)),
        feedUrl: fetchUrl,
      }
    } catch {
      // Fall through to try original URL
    }
  }

  const response = await timeout(FEED_FETCH_TIMEOUT, safeFetch(fetchUrl, headers))
  return {
    response,
    feedUrl: fetchUrl,
  }
}

// Reddit JSON parsing - inline to avoid circular dependencies
interface RedditPostData {
  title: string
  url: string
  permalink: string
  created_utc: number
  post_hint?: string
  preview?: {
    images: Array<{
      source: { url: string; width: number; height: number }
      resolutions: Array<{ url: string; width: number; height: number }>
    }>
  }
}

const IMAGE_DIMENSION_THRESHOLD = 1200

function parseRedditJson(
  url: string,
  text: string,
  startTime: number,
  downloadTime: number,
): RSSFeedWithMetrics {
  const parseTime = Date.now()
  const xmlTime = parseTime
  const feed = JSON.parse(text)
  const posts: Array<{ data: RedditPostData }> = feed.data.children

  const items: RSSItem[] = posts.map((post) => {
    const postData = post.data
    const redditMobileLink =
      urlUtils.getCanonicalUrl('m.' + urlUtils.REDDIT_COM).slice(0, -1) + postData.permalink
    const created = Math.floor(postData.created_utc * 1000)

    // Get thumbnail image
    let thumbnail: Array<{ url: string[]; width: number[]; height: number[] }> = []
    if (postData.preview?.images?.[0]) {
      const images = postData.preview.images[0]
      const allImages = [images.source, ...images.resolutions]
      const sortedImages = allImages.sort((a, b) => b.width - a.width)
      const bestImage =
        sortedImages.find(
          (img) =>
            img.width <= IMAGE_DIMENSION_THRESHOLD && img.height <= IMAGE_DIMENSION_THRESHOLD,
        ) || sortedImages[0]
      if (bestImage) {
        const imgUrl = bestImage.url.replace(/&amp;/g, '&')
        thumbnail = [
          { url: [imgUrl], width: [bestImage.width || 640], height: [bestImage.height || 422] },
        ]
      }
    }

    if (postData.post_hint == null) {
      // Text post or link post without media - link goes to external URL
      // For self-posts, postData.url is a relative URL, so use the comments link instead
      const linkUrl = postData.url.startsWith('/') ? redditMobileLink : postData.url
      return {
        title: postData.title,
        description: '',
        link: linkUrl,
        url: linkUrl,
        comments: redditMobileLink,
        created,
        media: { thumbnail },
      }
    }
    // Media post (image/video) - link goes to Reddit comments
    return {
      title: postData.title,
      description: '',
      link: redditMobileLink,
      url: redditMobileLink,
      comments: redditMobileLink,
      created,
      media: { thumbnail },
    }
  })

  return {
    feed: { title: '', description: '', url, items },
    url,
    size: text.length,
    downloadTime: downloadTime - startTime,
    xmlTime: xmlTime - downloadTime,
    parseTime: parseTime - xmlTime,
  }
}

export async function fetchFeed(url: string): Promise<RSSFeedWithMetrics> {
  const startTime = Date.now()
  const downloadTime = Date.now()
  const isRedditUrl = urlUtils.getHumanHostname(url) === urlUtils.REDDIT_COM
  const headers = isRedditUrl ? HEADERS_WITH_FELFELE : HEADERS_WITH_CURL
  const fetchUrl = isRedditUrl ? redditJsonFeedUrl(url) : url
  const { response, feedUrl } = await fetchResponse(fetchUrl, { headers })
  const text = await response.text()

  const feedLoader = isRedditUrl
    ? Promise.resolve(parseRedditJson(url, text, startTime, downloadTime))
    : loadRSSFeed(feedUrl, text, startTime, downloadTime)

  const feed = await timeout(FEED_FETCH_TIMEOUT, feedLoader)
  return feed
}

export async function loadRSSFeed(
  url: string,
  xml: string,
  startTime = 0,
  downloadTime = 0,
): Promise<RSSFeedWithMetrics> {
  const xmlTime = Date.now()

  // Check if content is JSON Feed (starts with '{')
  const trimmedContent = xml.trimStart()
  if (trimmedContent.startsWith('{')) {
    try {
      const json = JSON.parse(trimmedContent)
      if (isJsonFeed(json)) {
        const parseTime = Date.now()
        const feed = parseJsonFeed(json)
        return {
          feed,
          url,
          size: xml.length,
          downloadTime: downloadTime - startTime,
          xmlTime: xmlTime - downloadTime,
          parseTime: parseTime - xmlTime,
        }
      }
    } catch {
      // Not valid JSON, fall through to XML parsing
    }
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '_text',
    trimValues: false,
    parseAttributeValue: false,
    parseTagValue: false,
    // Return arrays for these elements to match react-native-xml2js behavior
    isArray: (name, jpath) => {
      const arrayTags = [
        'item',
        'entry',
        'channel',
        'link',
        'title',
        'description',
        'pubDate',
        'dc:date',
        'enclosure',
        'media:content',
        'media:thumbnail',
        'media:group',
        'content:encoded',
        'summary',
        'content',
        'published',
        'updated',
        'icon',
        'author',
        'category',
      ]
      return arrayTags.includes(name)
    },
  })

  const result = parser.parse(xml)
  const parseTime = Date.now()
  const rss = parseFeed(result)

  if (!rss) {
    throw new Error('Failed to parse feed')
  }

  const feedWithMetrics: RSSFeedWithMetrics = {
    feed: rss,
    url: url,
    size: xml.length,
    downloadTime: downloadTime - startTime,
    xmlTime: xmlTime - downloadTime,
    parseTime: parseTime - xmlTime,
  }

  return feedWithMetrics
}

// biome-ignore lint/suspicious/noExplicitAny: XML parsing returns dynamic structure
function parseFeed(json: any): RSSFeed | undefined {
  if (json.feed) {
    return parseAtomFeed(json)
  } else if (json.rss) {
    return parseRSSFeed(json)
  } else if (json['rdf:RDF']) {
    return parseRDFFeed(json)
  }
  return undefined
}

// biome-ignore lint/suspicious/noExplicitAny: XML parsing returns dynamic structure
function parseRSSFeed(json: any): RSSFeed {
  const channel = Array.isArray(json.rss.channel) ? json.rss.channel[0] : json.rss.channel
  return parseRSSChannel(channel)
}

// biome-ignore lint/suspicious/noExplicitAny: XML parsing returns dynamic structure
function parseRDFFeed(json: any): RSSFeed {
  const channel = Array.isArray(json['rdf:RDF'].channel)
    ? json['rdf:RDF'].channel[0]
    : json['rdf:RDF'].channel
  const items = json['rdf:RDF'].item
  return parseRSSChannel(channel, items)
}

// biome-ignore lint/suspicious/noExplicitAny: XML parsing returns dynamic structure
function getItems(channel: any, items?: [] | undefined) {
  if (items) {
    return items
  }
  if (!Array.isArray(channel.item)) {
    return [channel.item]
  }
  return channel.item
}

// biome-ignore lint/suspicious/noExplicitAny: XML parsing returns dynamic structure
function parseRSSChannel(channel: any, items?: [] | undefined): RSSFeed {
  const rss: RSSFeed = { title: '', description: '', url: '', items: [] }

  if (channel.title) {
    rss.title = Array.isArray(channel.title) ? channel.title[0] : channel.title
  }
  if (channel.description) {
    rss.description = Array.isArray(channel.description)
      ? channel.description[0]
      : channel.description
  }
  if (channel.link) {
    rss.url = Array.isArray(channel.link) ? channel.link[0] : channel.link
  }

  const channelItems = getItems(channel, items)
  if (channelItems) {
    // biome-ignore lint/suspicious/noExplicitAny: XML parsing returns dynamic structure
    channelItems.forEach((val: any) => {
      if (!val) return
      // biome-ignore lint/suspicious/noExplicitAny: Building RSS item
      const obj: any = {}
      obj.title = val.title != null ? (Array.isArray(val.title) ? val.title[0] : val.title) : ''
      obj.description =
        val.description != null
          ? Array.isArray(val.description)
            ? val.description[0]
            : val.description
          : ''
      const link = val.link != null ? (Array.isArray(val.link) ? val.link[0] : val.link) : ''
      obj.url = obj.link = link

      if (val.pubDate) {
        obj.created = Date.parse(Array.isArray(val.pubDate) ? val.pubDate[0] : val.pubDate)
      } else if (val['dc:date']) {
        obj.created = Date.parse(Array.isArray(val['dc:date']) ? val['dc:date'][0] : val['dc:date'])
      }
      if (val['media:content']) {
        obj.media = obj.media || {}
        obj.media.content = val['media:content']
      }
      if (val['media:thumbnail']) {
        obj.media = obj.media || {}
        obj.media.thumbnail = val['media:thumbnail']
      }
      if (val['thumb_large'] || val['thumb']) {
        obj.media = {}
        obj.media.thumbnail = [
          {
            url: val['thumb_large'] || val['thumb'],
          },
        ]
      }
      if (val.enclosure) {
        obj.enclosures = []
        let enclosures = val.enclosure
        if (!Array.isArray(enclosures)) {
          enclosures = [enclosures]
        }
        // biome-ignore lint/suspicious/noExplicitAny: Processing enclosures
        enclosures.forEach((enclosure: any) => {
          const enc: { [index: string]: unknown } = {}
          for (const x in enclosure) {
            enc[x] = Array.isArray(enclosure[x]) ? enclosure[x][0] : enclosure[x]
          }
          obj.enclosures.push(enc)
        })
      }
      if (val['content:encoded']) {
        obj.content = Array.isArray(val['content:encoded'])
          ? val['content:encoded'][0]
          : val['content:encoded']
      }
      if (val.comments) {
        obj.comments = Array.isArray(val.comments) ? val.comments[0] : val.comments
      }
      rss.items.push(obj)
    })
  }
  return rss
}
