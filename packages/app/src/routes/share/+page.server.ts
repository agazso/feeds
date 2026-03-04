import type { Actions } from './$types'
import type { Post } from '@feeds/core'
import { fetchHtmlMetaDataOnly, type HtmlMetaData } from '@feeds/core'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { fail } from '@sveltejs/kit'

function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
  const lowercaseUrl = url.toLowerCase()
  return imageExtensions.some((ext) => lowercaseUrl.includes(ext))
}

function mergeMetadata(urlMeta: HtmlMetaData, originMeta: HtmlMetaData): HtmlMetaData {
  return {
    ...urlMeta,
    name: urlMeta.name || originMeta.name,
    icon: urlMeta.icon || originMeta.icon,
  }
}

function buildPostFromMetadata(
  url: string,
  metadata: HtmlMetaData,
  originUrl: string,
): { post: Post; title: string } {
  // Handle image URLs specially
  let title = metadata.title?.trim() || ''
  let description = metadata.description?.trim() || ''
  let image = metadata.image

  if (isImageUrl(url)) {
    image = url
    title = ''
    description = ''
  }

  // Build post text
  const text =
    metadata.name && title ? `**${title}**\n\n${description}` : description || title || ''

  // Create Post object
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

async function fetchMetadataForUrl(
  url: string,
): Promise<{ metadata: HtmlMetaData; originUrl: string }> {
  // Fetch metadata for the URL
  const urlMetadata = await fetchHtmlMetaDataOnly(url)

  // Fetch origin metadata for icon/name fallback
  const originUrl = new URL(url).origin
  let originMetadata: HtmlMetaData | null = null
  if (originUrl !== url) {
    try {
      originMetadata = await fetchHtmlMetaDataOnly(originUrl)
    } catch {
      // Origin fetch failed, continue without it
    }
  }

  // Merge metadata
  const metadata = originMetadata ? mergeMetadata(urlMetadata, originMetadata) : urlMetadata

  return { metadata, originUrl }
}

export const actions = {
  share: async ({ request }) => {
    const formData = await request.formData()
    const url = formData.get('url')?.toString()?.trim()

    if (!url) {
      return fail(400, { error: 'URL is required' })
    }

    try {
      new URL(url)
    } catch {
      return fail(400, { error: 'Invalid URL format' })
    }

    try {
      const { metadata, originUrl } = await fetchMetadataForUrl(url)
      const { post, title } = buildPostFromMetadata(url, metadata, originUrl)

      // Read existing posts
      const filePath = join(process.cwd(), 'static', 'myposts.json')
      const content = await readFile(filePath, 'utf-8')
      const posts: Post[] = JSON.parse(content)

      // Prepend new post and write back
      const newPosts = [post, ...posts]
      await writeFile(filePath, JSON.stringify(newPosts, null, 4))

      return {
        success: true,
        post: {
          title: title || metadata.name || 'Shared link',
          icon: metadata.icon,
        },
      }
    } catch (e) {
      console.error('Share error:', e)
      return fail(500, { error: 'Failed to fetch URL metadata' })
    }
  },
} satisfies Actions
