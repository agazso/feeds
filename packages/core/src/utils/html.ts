export interface HtmlAttrNameValue {
  name: string
  value: string
}

export interface ParsedNode {
  nodeName: string
  childNodes: ParsedNode[]
  attrs?: Array<{ name: string; value: string }>
  value?: string // For text nodes
}

/**
 * Minimal HTML parser for extracting metadata.
 * Uses regex-based parsing for head elements only.
 */
export function parseHtml(html: string): ParsedNode {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const headContent = headMatch?.[1] ?? ''

  const links: ParsedNode[] = []
  const metas: ParsedNode[] = []

  // Parse link elements
  const linkRegex = /<link\s+([^>]*)>/gi
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = linkRegex.exec(headContent)) !== null) {
    const attrs = parseAttributes(linkMatch[1] ?? '')
    links.push({
      nodeName: 'link',
      childNodes: [],
      attrs,
    })
  }

  // Parse meta elements
  const metaRegex = /<meta\s+([^>]*)>/gi
  let metaMatch: RegExpExecArray | null
  while ((metaMatch = metaRegex.exec(headContent)) !== null) {
    const attrs = parseAttributes(metaMatch[1] ?? '')
    metas.push({
      nodeName: 'meta',
      childNodes: [],
      attrs,
    })
  }

  // Parse title element
  const titles: ParsedNode[] = []
  const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/gi
  let titleMatch: RegExpExecArray | null
  while ((titleMatch = titleRegex.exec(headContent)) !== null) {
    const textContent = decodeHtmlEntities(titleMatch[1]?.trim() ?? '')
    titles.push({
      nodeName: 'title',
      childNodes: [{ nodeName: '#text', childNodes: [], value: textContent }],
    })
  }

  // Parse script elements (for JSON-LD)
  const scripts: ParsedNode[] = []
  const scriptRegex = /<script\s+([^>]*)>([\s\S]*?)<\/script>/gi
  let scriptMatch: RegExpExecArray | null
  while ((scriptMatch = scriptRegex.exec(headContent)) !== null) {
    const attrs = parseAttributes(scriptMatch[1] ?? '')
    const content = scriptMatch[2] ?? ''
    scripts.push({
      nodeName: 'script',
      childNodes: [{ nodeName: '#text', childNodes: [], value: content }],
      attrs,
    })
  }

  return {
    nodeName: '#document',
    childNodes: [
      {
        nodeName: 'html',
        childNodes: [
          {
            nodeName: 'head',
            childNodes: [...links, ...metas, ...titles, ...scripts],
          },
        ],
      },
    ],
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&bull;/g, '•')
    .replace(/&hellip;/g, '…')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&amp;/g, '&') // Must be last
}

function parseAttributes(attrString: string): Array<{ name: string; value: string }> {
  const attrs: Array<{ name: string; value: string }> = []
  const attrRegex = /(\w+(?:-\w+)*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(attrString)) !== null) {
    const name = match[1] ?? ''
    const value = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')
    attrs.push({ name, value })
  }
  return attrs
}

export class HtmlUtils {
  public static parse(html: string): ParsedNode {
    return parseHtml(html)
  }

  public static findPath(node: ParsedNode, path: string[]): ParsedNode[] {
    const foundNodes: ParsedNode[] = []
    const pathPart = path[0]
    for (const childNode of node.childNodes) {
      if (childNode.nodeName === pathPart) {
        if (path.length > 1) {
          return HtmlUtils.findPath(childNode, path.slice(1))
        } else {
          foundNodes.push(childNode)
        }
      }
    }

    return foundNodes
  }

  public static matchAttributes(node: ParsedNode, attrs: HtmlAttrNameValue[]): boolean {
    if (!node.attrs) return false
    for (const attr of attrs) {
      let found = false
      for (const nodeAttr of node.attrs) {
        if (nodeAttr.name === attr.name && nodeAttr.value === attr.value) {
          found = true
          break
        }
      }
      if (!found) {
        return false
      }
    }
    return true
  }

  public static getAttribute(node: ParsedNode, name: string): string | null {
    if (!node.attrs) return null
    for (const attr of node.attrs) {
      if (attr.name === name) {
        return attr.value
      }
    }
    return null
  }
}
