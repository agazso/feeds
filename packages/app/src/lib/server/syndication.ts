import type { Post } from '@feeds/core'
import { postText, postTitle } from '../text'

/**
 * Serve a list of posts as RSS 2.0 or JSON Feed 1.1, so any page that renders posts
 * can also be subscribed to by appending `.rss` or `.json` to its URL.
 */

export type SyndicationFormat = 'rss' | 'json'

export function isSyndicationFormat(ext: string): ext is SyndicationFormat {
  return ext === 'rss' || ext === 'json'
}

interface FeedMeta {
  /** Channel title, e.g. "Feeds — music". */
  title: string
  /** The human page this feed mirrors. */
  link: string
  /** Absolute URL of the feed document itself. */
  self: string
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function postId(post: Post, index: number): string {
  return post.link || post._id?.toString() || `${post.createdAt}-${index}`
}

/** The same title/body split the cards show, so a reader sees what the page does. */
function itemTitle(post: Post): string {
  return postTitle(post) || post.rssItem?.title || post.link || ''
}

function itemToRss(post: Post, index: number): string {
  const link = post.link || ''
  const image = post.images[0]?.uri
  return `    <item>
      <title>${escapeXml(itemTitle(post))}</title>
      ${link ? `<link>${escapeXml(link)}</link>` : ''}
      <guid isPermaLink="${link ? 'true' : 'false'}">${escapeXml(postId(post, index))}</guid>
      <description>${escapeXml(postText(post) ?? '')}</description>
      <pubDate>${new Date(post.createdAt).toUTCString()}</pubDate>
      ${post.author?.name ? `<dc:creator>${escapeXml(post.author.name)}</dc:creator>` : ''}
      ${(post.tags ?? []).map((tag) => `<category>${escapeXml(tag)}</category>`).join('')}
      ${image ? `<enclosure url="${escapeXml(image)}" type="image/jpeg" length="0" />` : ''}
    </item>`
}

function toRss(posts: Post[], meta: FeedMeta): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <link>${escapeXml(meta.link)}</link>
    <description>${escapeXml(meta.title)}</description>
    <atom:link href="${escapeXml(meta.self)}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date(posts[0]?.createdAt ?? Date.now()).toUTCString()}</lastBuildDate>
${posts.map(itemToRss).join('\n')}
  </channel>
</rss>
`
}

function toJsonFeed(posts: Post[], meta: FeedMeta): string {
  return JSON.stringify(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: meta.title,
      home_page_url: meta.link,
      feed_url: meta.self,
      items: posts.map((post, index) => ({
        id: postId(post, index),
        url: post.link || undefined,
        title: itemTitle(post) || undefined,
        content_text: postText(post) ?? '',
        image: post.images[0]?.uri,
        date_published: new Date(post.createdAt).toISOString(),
        tags: post.tags?.length ? post.tags : undefined,
        authors: post.author?.name ? [{ name: post.author.name, url: post.author.uri }] : undefined,
      })),
    },
    null,
    2,
  )
}

export function syndicate(format: SyndicationFormat, posts: Post[], meta: FeedMeta): Response {
  const [body, type] =
    format === 'rss'
      ? [toRss(posts, meta), 'application/rss+xml']
      : [toJsonFeed(posts, meta), 'application/feed+json']
  return new Response(body, {
    headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'public, max-age=300' },
  })
}

/** The page this feed mirrors and the feed's own URL, both absolute. */
export function feedUrls(
  requestUrl: URL,
  format: SyndicationFormat,
): Pick<FeedMeta, 'link' | 'self'> {
  return {
    link: requestUrl.href.slice(0, -(format.length + 1)),
    self: requestUrl.href,
  }
}
