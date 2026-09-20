import { findFeedByKey, loadConfig } from '$lib/config'
import { loadPostsCached } from '$lib/feed-cache'
import { type SyndicationFormat, feedUrls, syndicate } from '$lib/server/syndication'
import { tagShorts } from '$lib/shorts'
import { error } from '@sveltejs/kit'

/**
 * A followed feed's posts as this app renders them — for an `enrich` feed that means
 * the enriched version, which is what the source feed cannot give you.
 *
 * The format is a trailing path segment (`/rss`), not an extension: a feed URL always
 * contains dots and a fifth of them end in `.rss` (Reddit), and SvelteKit splits an
 * `[ext]` param on the FIRST dot of the decoded path — `[...url].[ext]` would capture
 * every feed page as `url=https://www`.
 */
export async function syndicateFeed(
  format: SyndicationFormat,
  feedKey: string,
  requestUrl: URL,
  user?: string,
): Promise<Response> {
  if (!feedKey) throw error(400, 'Feed URL is required')

  const config = await loadConfig(user)
  const feed = findFeedByKey(config.feeds, decodeURIComponent(feedKey))
  if (!feed) throw error(404, 'Feed not found')

  // Same load as the page, so the feed and the page never disagree.
  const posts = tagShorts(await loadPostsCached([feed], user))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, config.maxPosts)

  return syndicate(format, posts, { title: feed.name, ...feedUrls(requestUrl, format) })
}
