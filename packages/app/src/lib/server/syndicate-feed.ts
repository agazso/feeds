import { error } from '@sveltejs/kit'
import { findFeedByKey, loadConfig } from '../config'
import { loadPostsCached } from '../feed-cache'
import { tagShorts } from '../shorts'
import { type SyndicationFormat, syndicate } from './syndication'

/**
 * A followed feed's posts as this app renders them — for an `enrich` feed that is the
 * version the source cannot give: the linked article's title, author and image, with
 * the aggregator's discussion link kept in `via`.
 *
 * Served from `/feeds.rss/<url>` rather than `/feeds/<url>.rss`, because a feed URL is
 * full of dots and a fifth of them end in `.rss` themselves (Reddit). Putting the
 * format ahead of the rest parameter settles it before the URL is read at all.
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

  return syndicate(format, posts, {
    title: feed.name,
    link: feedPageUrl(requestUrl, format),
    self: requestUrl.href,
  })
}

/**
 * The page this feed mirrors: `/feeds.rss/<url>` → `/feeds/<url>`. The segment occurs
 * once — a user prefix is `/@name`, and a name is restricted to `[a-z0-9_]`.
 */
export function feedPageUrl(requestUrl: URL, format: SyndicationFormat): string {
  return requestUrl.href.replace(`/feeds.${format}/`, '/feeds/')
}
