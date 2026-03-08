import { HtmlUtils, type ParsedNode } from './html'
import { createUrlFromUrn } from './url'

export interface OpenGraphData {
  title: string
  description: string
  image: string
  name: string
  siteName: string
  url: string
}

export async function fetchOpenGraphData(url: string): Promise<OpenGraphData> {
  try {
    const response = await fetch(url)
    const html = await response.text()
    const data = parseOpenGraphData(html, url)
    return data
  } catch {
    return {
      title: '',
      description: '',
      image: '',
      name: '',
      siteName: '',
      url,
    }
  }
}

export function parseOpenGraphData(html: string, baseUrl: string): OpenGraphData {
  const document = HtmlUtils.parse(html)
  return getHtmlOpenGraphData(document, baseUrl)
}

export function getHtmlOpenGraphData(document: ParsedNode, url: string): OpenGraphData {
  const ogData: OpenGraphData = {
    title: '',
    description: '',
    image: '',
    name: '',
    siteName: '',
    url,
  }

  const baseUrl = new URL(url).origin
  const metaElements = HtmlUtils.findPath(document, ['html', 'head', 'meta'])
  for (const meta of metaElements) {
    ogData.title = getPropertyIfValueNotSet(ogData.title, meta, 'og:title')
    ogData.description = getPropertyIfValueNotSet(ogData.description, meta, 'og:description')
    ogData.image = getPropertyIfValueNotSet(ogData.image, meta, 'og:image')
    ogData.name = getPropertyIfValueNotSet(ogData.name, meta, 'og:site_name')
    ogData.siteName = getPropertyIfValueNotSet(ogData.siteName, meta, 'og:site_name')
    ogData.url = getPropertyIfValueNotSet(ogData.url, meta, 'og:url')
  }

  // Fallback to standard meta description if og:description not found
  if (ogData.description === '') {
    for (const meta of metaElements) {
      if (HtmlUtils.matchAttributes(meta, [{ name: 'name', value: 'description' }])) {
        const content = HtmlUtils.getAttribute(meta, 'content')
        if (content) {
          ogData.description = content
          break
        }
      }
    }
  }

  // Fallback to title tag if og:title not found
  if (ogData.title === '') {
    const titleElements = HtmlUtils.findPath(document, ['html', 'head', 'title'])
    const titleElement = titleElements[0]
    if (titleElement) {
      const textNode = titleElement.childNodes.find((node) => node.nodeName === '#text')
      if (textNode?.value) {
        ogData.title = textNode.value
      }
    }
  }

  return normalizeOpenGraphData(ogData, baseUrl)
}

function normalizeOpenGraphData(ogData: OpenGraphData, baseUrl: string): OpenGraphData {
  if (!ogData.image) {
    return ogData
  }

  // make relative path absolute
  const absoluteUrlImage = createUrlFromUrn(ogData.image, baseUrl)

  // remove broken images pointing to the website and not an image
  const image = absoluteUrlImage === baseUrl + '/' ? '' : absoluteUrlImage

  return {
    ...ogData,
    image,
  }
}

function getPropertyIfValueNotSet(value: string, node: ParsedNode, name: string): string {
  return value === '' ? getOpenGraphPropertyContent(node, name) || '' : value
}

function getOpenGraphPropertyContent(node: ParsedNode, name: string): string | null {
  // Check both 'property' (correct) and 'name' (common mistake) attributes
  if (
    HtmlUtils.matchAttributes(node, [{ name: 'property', value: name }]) ||
    HtmlUtils.matchAttributes(node, [{ name: 'name', value: name }])
  ) {
    return HtmlUtils.getAttribute(node, 'content')
  }
  return null
}
