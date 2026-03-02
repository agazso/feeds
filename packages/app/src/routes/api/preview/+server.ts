import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { Post } from '@feeds/core'
import { fetchHtmlMetaDataOnly, type HtmlMetaData } from '@feeds/core'

function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
  const lowercaseUrl = url.toLowerCase()
  return imageExtensions.some((ext) => lowercaseUrl.includes(ext))
}

function mergeMetadata(urlMeta: HtmlMetaData, originMeta: HtmlMetaData): HtmlMetaData {
  return {
    ...urlMeta,
    name: urlMeta.name || originMeta.name,
    icon: urlMeta.icon || originMeta.icon
  }
}

function buildPostFromMetadata(url: string, metadata: HtmlMetaData, originUrl: string): Post {
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

  return {
    _id: `${url}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: Date.now(),
    images: image ? [{ uri: image }] : [],
    link: url,
    author: {
      name: metadata.name || title || new URL(url).hostname,
      uri: originUrl,
      image: { uri: metadata.icon }
    }
  }
}

async function fetchMetadataForUrl(
  url: string
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

  const metadata = originMetadata ? mergeMetadata(urlMetadata, originMetadata) : urlMetadata
  return { metadata, originUrl }
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const url = body.url?.trim()

  if (!url) {
    return json({ preview: null })
  }

  try {
    new URL(url)
  } catch {
    return json({ preview: null })
  }

  try {
    const { metadata, originUrl } = await fetchMetadataForUrl(url)
    const post = buildPostFromMetadata(url, metadata, originUrl)
    return json({ preview: post })
  } catch (e) {
    console.error('Preview error:', e)
    return json({ preview: null })
  }
}
