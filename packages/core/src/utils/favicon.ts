import { safeFetch } from './fetch'
import { HtmlUtils, type ParsedNode } from './html'
import * as urlUtils from './url'

interface Icon {
  href: string
  size: number
}

export const DEFAULT_FAVICON = 'favicon.ico'

export async function fetchSiteFaviconUrl(url: string): Promise<string> {
  const baseUrl = urlUtils.getBaseUrl(url)
  try {
    const favicon = await downloadIndexAndParseFavicon(baseUrl)
    if (favicon == null) {
      return urlUtils.createUrlFromUrn(DEFAULT_FAVICON, url)
    }
    return favicon
  } catch {
    return ''
  }
}

export async function fetchFaviconUrl(url: string): Promise<string | undefined> {
  try {
    return await downloadIndexAndParseFavicon(url)
  } catch {
    return undefined
  }
}

async function fetchHtml(url: string): Promise<string> {
  const response = await safeFetch(url)
  const html = await response.text()
  return html
}

function matchRelAttributes(node: ParsedNode, values: string[]): string | null {
  for (const value of values) {
    if (HtmlUtils.matchAttributes(node, [{ name: 'rel', value: value }])) {
      const favicon = HtmlUtils.getAttribute(node, 'href') || ''
      if (favicon !== '') {
        return favicon
      }
    }
  }
  return null
}

function getBestSizeFromAttribute(sizesAttr: string): number {
  const getSize = (sizeAttr: string) => Number.parseInt(sizeAttr.split(/[xX]/)[0] ?? '0', 10) || 0
  const sizes = sizesAttr
    .split(' ')
    .map((size) => getSize(size))
    .sort((a, b) => b - a)

  return sizes.length > 0 ? (sizes[0] ?? 0) : 0
}

function findIconsInLinks(links: ParsedNode[]): Icon[] {
  const isIcon = (icon: Partial<Icon>): icon is Icon => icon.href != null && icon.size != null
  return links
    .map((link) => {
      const href =
        matchRelAttributes(link, ['shortcut icon', 'icon', 'apple-touch-icon']) || undefined
      const sizes = HtmlUtils.getAttribute(link, 'sizes') || ''
      const size = getBestSizeFromAttribute(sizes)
      return {
        href,
        size,
      }
    })
    .filter<Icon>(isIcon)
}

function getBestIcon(icons: Icon[]): Icon | undefined {
  const iconExtensionWeight = (iconHref: string) =>
    iconHref.endsWith('.png') ? 2 : iconHref.endsWith('.ico') ? 1 : 0

  const compareIconExtension = (a: string, b: string) =>
    iconExtensionWeight(b) - iconExtensionWeight(a)
  const sortedIcons = icons.sort((a, b) => b.size - a.size || compareIconExtension(a.href, b.href))
  return sortedIcons.length > 0 ? sortedIcons[0] : undefined
}

export function findBestIconFromLinks(links: ParsedNode[]): string | undefined {
  const icons = findIconsInLinks(links)
  const icon = getBestIcon(icons)
  return icon != null ? icon.href : undefined
}

async function downloadIndexAndParseFavicon(url: string): Promise<string | undefined> {
  const html = await fetchHtml(url)
  const favicon = parseFaviconFromHtml(html)
  if (favicon != null) {
    return urlUtils.createUrlFromUrn(favicon, url)
  }
  return undefined
}

export function parseFaviconFromHtml(html: string): string | undefined {
  const document = HtmlUtils.parse(html)
  const links = HtmlUtils.findPath(document, ['html', 'head', 'link'])
  return findBestIconFromLinks(links)
}
