import { parseDocument } from 'htmlparser2'
import type { Document, Element, Text, ChildNode } from 'domhandler'

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
 * HTML parser for extracting metadata.
 * Uses htmlparser2 for robust parsing of malformed HTML.
 */
export function parseHtml(html: string): ParsedNode {
  const dom = parseDocument(html)
  return convertDocument(dom)
}

function convertDocument(doc: Document): ParsedNode {
  // Find the html element
  const htmlElement = doc.children.find(
    (child): child is Element => child.type === 'tag' && child.name === 'html',
  )

  if (htmlElement) {
    // Find head element within html
    const headElement = htmlElement.children.find(
      (child): child is Element => child.type === 'tag' && child.name === 'head',
    )

    if (headElement) {
      // Standard case: <html><head>...</head></html>
      return {
        nodeName: '#document',
        childNodes: [
          {
            nodeName: 'html',
            childNodes: [
              {
                nodeName: 'head',
                childNodes: headElement.children.map(convertNode),
              },
            ],
          },
        ],
      }
    }

    // No <head> element: collect metadata elements directly from <html> children
    // This handles pages like isaacfreund.com that have <meta>, <title>, <link>
    // as direct children of <html> without a <head> wrapper
    const headNodes = collectHeadNodes(htmlElement.children)
    return {
      nodeName: '#document',
      childNodes: [
        {
          nodeName: 'html',
          childNodes: [
            {
              nodeName: 'head',
              childNodes: headNodes,
            },
          ],
        },
      ],
    }
  }

  // No <html> element: collect metadata elements directly from document root
  // This handles fragments or very malformed HTML
  const headNodes = collectHeadNodes(doc.children)
  return {
    nodeName: '#document',
    childNodes: [
      {
        nodeName: 'html',
        childNodes: [
          {
            nodeName: 'head',
            childNodes: headNodes,
          },
        ],
      },
    ],
  }
}

/**
 * Collect head-type elements (meta, title, link, script) from a list of nodes.
 * This handles HTML where these elements appear without a <head> wrapper.
 */
function collectHeadNodes(children: ChildNode[]): ParsedNode[] {
  const headElementNames = ['meta', 'title', 'link', 'script', 'base', 'style']
  const result: ParsedNode[] = []

  for (const child of children) {
    if (child.type === 'tag' && headElementNames.includes(child.name)) {
      result.push(convertNode(child))
    }
  }

  return result
}

function convertNode(node: ChildNode): ParsedNode {
  if (node.type === 'text') {
    const textNode = node as Text
    return {
      nodeName: '#text',
      childNodes: [],
      value: decodeHtmlEntities(textNode.data),
    }
  }

  if (node.type === 'tag') {
    const element = node as Element
    return {
      nodeName: element.name,
      childNodes: element.children?.map(convertNode) ?? [],
      attrs: Object.entries(element.attribs).map(([name, value]) => ({
        name,
        value: decodeHtmlEntities(String(value)),
      })),
    }
  }

  // For other node types (comments, directives, etc.), return empty node
  return {
    nodeName: '#unknown',
    childNodes: [],
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
