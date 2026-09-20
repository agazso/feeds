import { type Feed, buildOPML } from '@feeds/core'

/**
 * An OPML subscription list, as a download. Every reader imports this format, so it is
 * how a set of feeds leaves here for somewhere else.
 */
export function opmlResponse(feeds: Feed[], filename: string, title: string): Response {
  return new Response(buildOPML(feeds, title), {
    headers: {
      'content-type': 'text/x-opml; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}.opml"`,
      'cache-control': 'public, max-age=300',
    },
  })
}

/** `music+guitar` → `feeds-music-guitar`, and just `feeds` when nothing is selected. */
export function opmlFilename(tags: string[]): string {
  const slug = tags
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `feeds-${slug}` : 'feeds'
}
