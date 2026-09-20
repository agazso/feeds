import { getFaviconForUrl } from '../favicon-helpers'
import type { Feed } from '../models/feed'
import type { RSSFeed, RSSFeedWithMetrics, RSSItem, RSSThumbnail } from '../models/rss'
import { fetchFaviconUrl } from '../utils/favicon'
import { safeFetch } from '../utils/fetch'
import { HEADERS_WITH_FELFELE } from '../utils/headers'
import * as urlUtils from '../utils/url'

interface RedditImageData {
  url: string
  width: number
  height: number
}

interface RedditImage {
  source: RedditImageData
  resolutions: RedditImageData[]
}

interface RedditPostData {
  title: string
  url: string
  is_video: boolean
  permalink: string
  created_utc: number
  post_hint: undefined | 'link' | 'image' | 'hosted:video'
  preview?: {
    images: RedditImage[]
    enabled: boolean
  }
  url_overridden_by_dest?: string
  selftext?: string // Post text content
  author?: string // Post author username
  subreddit?: string // Subreddit name
}

interface RedditCommentData {
  body: string // Comment text
  author: string // Comment author username
  created_utc: number
  permalink: string
  link_title?: string // Title of the parent post
  subreddit?: string
}

interface RedditPost {
  kind: string
  data: RedditPostData
}

interface RedditAbout {
  kind: string
  data: RedditAboutData
}

interface RedditAboutData {
  icon_img?: string
  community_icon?: string
  title?: string
}

const IMAGE_DIMENSION_THRESHOLD = 1200

export function redditJsonFeedUrl(url: string): string {
  if (url.endsWith('.rss')) {
    return url.slice(0, -4).concat('.json')
  }
  if (url.endsWith('.json')) {
    return url
  }
  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  return canonicalUrl.endsWith('/') ? canonicalUrl.concat('.json') : canonicalUrl.concat('/.json')
}

function findBestResolutionRedditImage(redditImage: RedditImage): RedditImageData | undefined {
  const allImages = [redditImage.source, ...redditImage.resolutions]
  const sortedImages = allImages.sort((a, b) => b.width - a.width)
  for (const image of sortedImages) {
    if (image.width > IMAGE_DIMENSION_THRESHOLD || image.height > IMAGE_DIMENSION_THRESHOLD) {
      continue
    }
    return image
  }
  return sortedImages.length > 0 ? sortedImages[0] : undefined
}

function redditPostDataImages(postData: RedditPostData): RSSThumbnail[] {
  const image =
    postData.preview != null && postData.preview.images[0]
      ? findBestResolutionRedditImage(postData.preview.images[0])
      : undefined

  if (!image) {
    return []
  }

  // fix reddit image url as seen at
  // https://stackoverflow.com/questions/63611376/fetching-an-image-from-reddit-javascript-react-no-praw
  const url = image.url.replace('amp;s', 's').replace('amp;', '').replace('amp;', '')
  const width = image.width ? image.width : 640
  const height = image.height ? image.height : 422
  return [
    {
      url: [url],
      width: [width],
      height: [height],
    },
  ]
}

function redditPostDataToRSSItem(postData: RedditPostData): RSSItem {
  const redditMobileLink =
    urlUtils.getCanonicalUrl('m.' + urlUtils.REDDIT_COM).slice(0, -1) + postData.permalink
  const created = Math.floor(postData.created_utc * 1000)
  const thumbnail = redditPostDataImages(postData)
  if (postData.post_hint == null) {
    return {
      title: '',
      description: postData.title + `<p/>[Comments](${redditMobileLink})`,
      link: postData.url,
      url: postData.url,
      created,
      media: {
        thumbnail,
      },
    }
  } else {
    return {
      title: '',
      description: postData.title,
      link: redditMobileLink,
      url: redditMobileLink,
      created,
      media: {
        thumbnail,
      },
    }
  }
}

export function loadRedditFeed(
  url: string,
  text: string,
  startTime: number,
  downloadTime: number,
): RSSFeedWithMetrics {
  const parseTime = Date.now()
  const xmlTime = parseTime
  const feed = JSON.parse(text)
  const posts: RedditPost[] = feed.data.children
  const items: RSSItem[] = posts.map((post) => redditPostDataToRSSItem(post.data))
  const rssFeed: RSSFeed = {
    title: '',
    description: '',
    url,
    items,
  }
  const rssFeedWithMetrics: RSSFeedWithMetrics = {
    feed: rssFeed,
    url,
    size: text.length,
    downloadTime: downloadTime - startTime,
    xmlTime: xmlTime - downloadTime,
    parseTime: parseTime - xmlTime,
  }
  return rssFeedWithMetrics
}

export function isRedditLink(url: string): boolean {
  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  const humanHostName = urlUtils.getHumanHostname(canonicalUrl)
  return humanHostName === urlUtils.REDDIT_COM
}

function parseSubredditFromUrl(url: string): string | undefined {
  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  const domainAndQuery = canonicalUrl.split('//', 2)?.[1]
  if (domainAndQuery == null) {
    return undefined
  }
  const parts = domainAndQuery.split('/')
  if (parts.length < 3) {
    return undefined
  }
  const [, r, sub] = parts
  if (r !== 'r') {
    return undefined
  }
  if (sub == null) {
    return undefined
  }
  const subredditParts = sub.split('.')
  if (subredditParts.length === 0) {
    return sub
  }
  return subredditParts[0]
}

export interface RedditLink {
  canonicalUrl: string
  subreddit: string
}

export function makeCanonicalRedditLink(url: string): RedditLink | undefined {
  if (!isRedditLink(url)) {
    return undefined
  }
  const subreddit = parseSubredditFromUrl(url)
  if (subreddit == null) {
    return undefined
  }
  return {
    canonicalUrl: `https://${urlUtils.REDDIT_COM}/r/${subreddit}`,
    subreddit,
  }
}

/**
 * Rewrite a reddit.com URL to old.reddit.com (any subdomain → old). old.reddit serves
 * real OpenGraph tags to bots without the "please verify" interstitial that
 * www.reddit.com returns to non-browser user-agents. Non-reddit URLs are unchanged.
 */
export function toOldRedditUrl(url: string): string {
  return url.replace(/:\/\/(?:www\.|np\.|m\.|old\.)?reddit\.com/, '://old.reddit.com')
}

/**
 * Reddit serves link/image posts an og:description of the form
 * "Posted in r/<sub> by u/<user> • <N> points and <M> comments" — site chrome with
 * vote/comment counts. Drop it (self/text posts keep their real body, which does not
 * match this shape). Returns '' for the chrome line, the input otherwise.
 */
export function stripRedditPostChrome(description: string): string {
  const isChrome =
    /^Posted in r\/\S+ by u\/\S+/i.test(description) && /\b(points?|comments?)\b/i.test(description)
  return isChrome ? '' : description
}

function getAboutIcon(about: RedditAbout): string | undefined {
  if (about.data.icon_img != null && about.data.icon_img !== '') {
    return about.data.icon_img.replace(/&amp;/g, '&')
  }
  if (about.data.community_icon != null && about.data.community_icon !== '') {
    return about.data.community_icon.replace(/&amp;/g, '&')
  }
  return undefined
}

export async function fetchRedditFeed(url: string): Promise<Feed | undefined> {
  const redditLink = makeCanonicalRedditLink(url)
  if (redditLink == null) {
    return undefined
  }
  const canonicalUrl = redditLink.canonicalUrl
  // We store the feedUrl as RSS, so that it can be exported easily
  const feedUrl = canonicalUrl + '.rss'
  const aboutJsonUrl = canonicalUrl + '/about.json'

  try {
    // about.json needs authentication now (Reddit shut down the unauthenticated
    // JSON API → 403). Kept for a future OAuth mode; falls back to .rss below.
    const response = await safeFetch(aboutJsonUrl, { headers: HEADERS_WITH_FELFELE })
    const about = (await response.json()) as RedditAbout
    if (about.data.title == null) {
      return undefined
    }
    const name = about.data.title
    const aboutIcon = getAboutIcon(about)
    const favicon = aboutIcon != null ? aboutIcon : (await fetchFaviconUrl(canonicalUrl)) || ''

    return {
      name,
      url: canonicalUrl,
      feedUrl,
      favicon,
    }
  } catch {
    // about.json blocked (403) → use the public .rss feed: subreddit slug as the
    // name and the hardcoded Reddit favicon.
    return {
      name: `r/${redditLink.subreddit}`,
      url: canonicalUrl,
      feedUrl,
      favicon: getFaviconForUrl(canonicalUrl) ?? '',
    }
  }
}

/**
 * Metadata extracted from a Reddit post or comment.
 */
export interface RedditPostMetadata {
  title: string
  description: string
  author: string
  subreddit: string
  createdAt: number
  image?: string
}

/**
 * Check if a URL is a Reddit post or comment URL (not a subreddit URL).
 * Post URLs contain /comments/ in the path.
 */
export function isRedditPostUrl(url: string): boolean {
  if (!isRedditLink(url)) {
    return false
  }
  const canonicalUrl = urlUtils.getCanonicalUrl(url)
  return canonicalUrl.includes('/comments/')
}

/**
 * Fetch rich metadata from a Reddit post or comment URL.
 * Uses Reddit's JSON API by appending .json to the URL.
 */
export async function fetchRedditPostMetadata(
  url: string,
): Promise<RedditPostMetadata | undefined> {
  if (!isRedditPostUrl(url)) {
    return undefined
  }

  try {
    // Clean up URL and append .json
    const cleanUrl = url.split('?')[0] ?? url // Remove query params
    const jsonUrl = cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) + '.json' : cleanUrl + '.json'

    const response = await safeFetch(jsonUrl, { headers: HEADERS_WITH_FELFELE })
    const data = await response.json()

    // Reddit returns an array: [post_listing, comments_listing]
    // For comment URLs, the second element contains the target comment
    if (!Array.isArray(data) || data.length < 1) {
      return undefined
    }

    const postListing = data[0]
    const commentListing = data[1]

    // Extract post data
    const postData = postListing?.data?.children?.[0]?.data as RedditPostData | undefined
    if (!postData) {
      return undefined
    }

    // Check if this is a comment URL (has second listing with comments)
    const isCommentUrl = url.includes('/comment/')
    const commentData = commentListing?.data?.children?.[0]?.data as RedditCommentData | undefined

    const title = postData.title
    let description = ''
    let author = postData.author || ''
    const subreddit = postData.subreddit || ''
    let createdAt = Math.floor(postData.created_utc * 1000)

    if (isCommentUrl && commentData) {
      // For comment URLs, use comment body as description and prepend post title
      description = commentData.body || ''
      author = commentData.author || author
      createdAt = Math.floor(commentData.created_utc * 1000)
    } else {
      // For post URLs, use selftext as description
      description = postData.selftext || ''
    }

    // Extract preview image
    let image: string | undefined
    if (postData.preview?.images?.[0]) {
      const bestImage = findBestResolutionRedditImage(postData.preview.images[0])
      if (bestImage) {
        // Fix Reddit image URL encoding
        image = bestImage.url.replace(/&amp;/g, '&')
      }
    }

    return {
      title,
      description,
      author,
      subreddit,
      createdAt,
      image,
    }
  } catch {
    return undefined
  }
}
