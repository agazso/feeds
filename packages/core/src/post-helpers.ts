import type { Author } from './models/author'
import type { Post } from './models/post'
import { type HtmlMetaData, fetchHtmlMetaDataOnly } from './parsers/html-metadata'
import { isImageUrl } from './utils/url'

export function mergeHtmlMetadata(
  urlMeta: HtmlMetaData,
  originMeta: HtmlMetaData,
): HtmlMetaData {
  return {
    ...urlMeta,
    name: urlMeta.name || originMeta.name,
    icon: urlMeta.icon || originMeta.icon,
  }
}

export function buildPostFromMetadata(
  url: string,
  metadata: HtmlMetaData,
  originUrl: string,
): { post: Post; title: string } {
  let title = metadata.title?.trim() || ''
  let description = metadata.description?.trim() || ''
  let image = metadata.image

  if (isImageUrl(url)) {
    image = url
    title = ''
    description = ''
  }

  const text =
    metadata.name && title ? `**${title}**\n\n${description}` : description || title || ''

  const post: Post = {
    _id: `${url}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: Date.now(),
    images: image ? [{ uri: image }] : [],
    link: url,
    author: {
      name: metadata.name || title || new URL(url).hostname,
      uri: originUrl,
      image: { uri: metadata.icon },
    },
  }

  return { post, title }
}

export async function fetchEnrichedMetadata(
  url: string,
): Promise<{ metadata: HtmlMetaData; originUrl: string }> {
  const urlMetadata = await fetchHtmlMetaDataOnly(url)

  const originUrl = new URL(url).origin
  let originMetadata: HtmlMetaData | null = null
  if (originUrl !== url) {
    try {
      originMetadata = await fetchHtmlMetaDataOnly(originUrl)
    } catch {
      // Origin fetch failed, continue without it
    }
  }

  const metadata = originMetadata ? mergeHtmlMetadata(urlMetadata, originMetadata) : urlMetadata

  return { metadata, originUrl }
}

export function mergeUpdatedPosts(updatedPosts: Post[], oldPosts: Post[]): Post[] {
  const uniqueAuthors = new Map<string, Author>()
  updatedPosts.forEach((post) => {
    if (post.author != null) {
      if (!uniqueAuthors.has(post.author.uri)) {
        uniqueAuthors.set(post.author.uri, post.author)
      }
    }
  })
  const notUpdatedPosts = oldPosts.filter(
    (post) => post.author != null && !uniqueAuthors.has(post.author.uri),
  )
  const allPosts = notUpdatedPosts.concat(updatedPosts)
  const sortedPosts = allPosts.sort((a, b) => b.createdAt - a.createdAt)
  const startId = Date.now()
  const posts = sortedPosts.map((post, index) => ({
    ...post,
    _id: post._id ? post._id : startId + index,
  }))
  return posts
}
