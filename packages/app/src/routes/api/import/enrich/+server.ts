import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchHtmlMetaDataOnly, type HtmlMetaData } from '@feeds/core'

function mergeMetadata(urlMeta: HtmlMetaData, originMeta: HtmlMetaData): HtmlMetaData {
  return {
    ...urlMeta,
    name: urlMeta.name || originMeta.name,
    icon: urlMeta.icon || originMeta.icon
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
    return json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const { metadata } = await fetchMetadataForUrl(url)
    return json({
      metadata: {
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
        icon: metadata.icon
      }
    })
  } catch (e) {
    console.error('Enrich error:', e)
    return json({ error: 'Failed to fetch metadata' }, { status: 500 })
  }
}
