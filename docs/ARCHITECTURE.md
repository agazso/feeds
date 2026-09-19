# Architecture: content discovery & enrichment pipeline

This document maps how a URL becomes a feed and a post, so a small change can be
made with full context. Feed discovery + enrichment is the most regression-prone
area of the codebase — the web is full of edge cases and **YouTube behaves like
its own platform**. Read §5 (Invariants) before touching anything here.

Line numbers drift; functions are referenced by `file:function`. When in doubt,
`grep -n "function <name>"`.

---

## 1. Packages & boundaries

- **`@feeds/core`** — the engine: discovery, parsing, enrichment, post-building.
  Pure logic, **no disk access**, network via `fetch`. This is where the pipeline
  lives.
- **`@feeds/app`** — SvelteKit reader: routes + API endpoints, persistence to
  `static/feeds.json` / `static/myposts.json`, image/favicon cache under `cache/`.
  Consumes core via its built `dist` (ESM `import`).
- **`@feeds/cli`** — terminal feed discovery/management over the same core.

The app never re-implements parsing/discovery — it calls core and adds
persistence, caching, auth, and UI.

---

## 2. The core pipeline

Three stages. Entry points live in the top-level helper files; the parsers and
providers do the work.

### Stage A — Discover a feed from a URL
`fetchFeedsFromUrl(url)` — `feed-helpers.ts` — is the single discovery entry point.
It routes by provider, else falls back to generic content sniffing:

```
fetchFeedsFromUrl(url)                         feed-helpers.ts
├─ isRedditLink   → fetchRedditFeed            providers/reddit.ts
├─ isYoutubeLink  → fetchYoutubeFeed           providers/youtube.ts
├─ isTwitterLink  → fetchTwitterFeed           providers/twitter.ts
└─ generic:
   fetchContentResult(url)                     parsers/rss-post.ts
   → fetchFeedByContentWithMimeType(url, …)    parsers/rss-post.ts
       ├─ HTML  → extract <link rel=alternate> feed, or try alt locations
       ├─ RSS/Atom/JSON → loadRSSFeed          parsers/rss.ts
       └─ augmentFeedWithMetadata(...)         parsers/rss-post.ts  (favicon, name)
```

### Stage B — Fetch the feed's items
- `fetchFeed(feedUrl)` → `loadRSSFeed(url, xml)` — `parsers/rss.ts` — fetch + parse
  RSS 2.0 / RSS 1.0 / Atom / JSON Feed into `RSSFeedWithMetrics`.
- `loadPosts(feeds)` / `convertRSSFeedtoPosts(...)` — `parsers/rss-post.ts` —
  turn RSS items into `Post[]` for a followed feed (this is what `/feeds/[...url]`
  renders). Note: `convertRSSFeedtoPosts` builds `Post` objects **inline**, it does
  not go through `createPost`.

### Stage C — Enrich a single link into a Post
This is the share/discover path (fetch the article page for richer metadata):

```
createEnrichedPost(url, options?)              post-helpers.ts
├─ fetchEnrichedMetadata(url)                  post-helpers.ts
│   ├─ Reddit post? → fetchRedditPostMetadata  providers/reddit.ts
│   ├─ fetchHtmlMetaDataOnly(url)              parsers/html-metadata.ts
│   │   └─ parseHtmlMetaData(url, html)        parsers/html-metadata.ts
│   │       ├─ getYoutubeWatchInfo(url, html)  → channel name + feed URL
│   │       ├─ og:* / twitter:* / JSON-LD / <meta>   (title, name, author, image)
│   │       └─ parseAllFeedLinksFromHtml       → feedUrl
│   ├─ origin / author-path fallback fetches   (multi-author sites)
│   └─ enrichFromManifest(origin)              (site.webmanifest name/icon)
├─ feedUrl = options.feedUrl || metadata.feedUrl || discoverFeedUrl(origin)
└─ createPost({ url, metadata, originUrl, feedUrl, feedIcon, rssItem, … })
```

`createPost(params)` — `post-helpers.ts` — is the **single Post constructor for the
enrich path**: it computes the author identity (`shouldUseFeedName`,
`formatAuthorName`), the text, and the image.

### High-level discovery wrappers (`discover-feed.ts`)
- `discoverFeedFromUrl(url)` — quick feed info (name/url/feedUrl/favicon), no items.
- `discoverAndEnrichFeed(url)` — full preview: discover the feed, fetch its items,
  and `createEnrichedPost` **each** item (parallel, with per-item timeout), then
  `applyDiscoveredFeedDefaults(post, feedUrl, item)` to backfill the feed's `feedUrl`
  and the RSS thumbnail onto every post.

### Cross-cutting layers
- **Networking** — `safeFetch` (`utils/fetch.ts`, throws on non-2xx) and
  `getHeadersForUrl` + `HEADERS_WITH_*` (`utils/headers.ts`) select the user-agent
  (Reddit → FELFELE, default → Discordbot).
- **URL** — `utils/url.ts` (see §5 for the critical `getCanonicalUrl` vs
  `normalizeUrl` distinction).
- **Favicon** — `utils/favicon.ts` (`parseFaviconFromHtml`, `DEFAULT_FAVICON`),
  `favicon-helpers.ts` (`getFaviconForUrl` hardcoded X/Reddit, `transformPostImages`),
  and the best-effort default inside `augmentFeedWithMetadata`.
- **HTML** — `HtmlUtils` (`utils/html.ts`) parse/traverse helpers.

---

## 3. The app side

### Endpoint → core function
| Endpoint / loader | Core functions used |
|---|---|
| `POST /api/preview` | `normalizeUrl`, `createEnrichedPost`, `discoverFeedFromUrl`, `transformPostImages` |
| `POST /api/myfeed` (url-mode) | `createEnrichedPost`, `discoverFeedFromUrl`, `getFaviconForUrl` |
| `POST /api/myfeed` (post-mode) | reuses `previewPost`; `discoverFeedFromUrl`, `getFaviconForUrl` |
| `POST /api/discover` | `discoverAndEnrichFeed` |
| `POST /api/feeds` (add) | `resolveYoutubeChannelUrl` + `loadConfig`/`saveConfig` |
| `PATCH /api/feeds/[...url]` (tags) | `loadConfig`/`saveConfig` (match by `feedUrl` then `url`) |
| `GET /api/tags` | `loadPosts`, `buildFeedUrlToPageUrl`, tag helpers (`$lib/tags.ts`) |
| `/feeds/[...url]` page | `loadPosts([feed])` (match by `feedUrl` then `url`) |
| `/share/[...url]` loader | `fetchFeedsFromUrl` (discover feed for tag auto-select) |

### Save-a-post flow
1. Share page `routes/share/[...url]/+page.svelte` → `POST /api/preview` → enriched
   `previewPost` (also cached in `sessionStorage`).
2. `routes/share/[...url]/+page.server.ts` resolves the `feedUrl` context + auto-selected
   `feedTags` (query param, else `fetchFeedsFromUrl` discovery).
3. On save → `POST /api/myfeed?feedUrl=…`:
   - **post-mode** (default): reuse `previewPost` (no re-enrich) — see the
     "enrich only once" history.
   - **url-mode** (fallback): `createEnrichedPost(url)`.
   Both attach `feedUrl` + `tags`, run `processImage`/`processFavicon`, then prepend
   to `static/myposts.json`.

### Multi-user scoping
A path may start with `/@name`. `reroute` (`src/hooks.ts`) strips the prefix so a single
route tree serves both modes; `handle` (`hooks.server.ts`) reads the name back off the
untouched `event.url`, 404s unknown users, and puts it in `locals.user` — lowercased,
and restricted to `[a-z0-9_]` so it can never escape the data dir. Every persistence
call takes that `user` and resolves against `dataDir(user)` / `cacheDir(user)`
(`$lib/paths.ts`) — `DATA_DIR/@bob/` and `CACHE_DIR/@bob/`, or the roots when undefined.
On the client, `prefix()` (`$lib/prefix.ts`) supplies the same prefix for links and
`fetch`. Write auth is per scope, keyed by a `users.json` **beside** DATA_DIR
(`$lib/server/auth.ts`; `FEEDS_KEYFILE` overrides), read per request so a hand-edited key
needs no restart. It must never live *inside* DATA_DIR — that defaults to `static/`, which
is served publicly and copied into `build/client/`. `/invite` is the only page whose **reads**
are gated (`requireRootScope`): it displays keys.

### Persistence & caching
- `loadConfig`/`saveConfig` (`$lib/config.ts`) ⇄ `static/feeds.json`
  (`{ feeds, maxPosts }`); `loadMyfeedPosts` (`$lib/myfeed.ts`) ⇄ `static/myposts.json`.
- `$lib/server/imageProcessing.ts`: `processImage` (blurhash + WebP), `processFavicon`
  (64×64 WebP), content-addressed under `cache/<a>/<b>/<hash>.<ext>`, ref-counted
  `deleteCachedImage` on post delete; served by `/cache/[...path]`.

### Key UI contract
`PostCard.svelte` shows the **RSS icon iff `post.feedUrl` is set**, the author avatar
(hidden on load error via `avatarError`), and a menu that picks **View feed**
(followed) vs **Discover Feed** (not) using `buildFeedUrlToPageUrl` membership
(`$lib/tags.ts`). "View feed" links by `feedUrl` (not `url`).

---

## 4. Provider "other worlds"

- **YouTube** (`providers/youtube.ts` + `getYoutubeWatchInfo` in
  `parsers/html-metadata.ts`):
  - Watch pages report `og:site_name = "YouTube"` and no author, but embed
    `"ownerChannelName"` and `"externalChannelId"` — `getYoutubeWatchInfo` extracts
    both to set the channel as author and derive the feed
    `…/feeds/videos.xml?channel_id=<id>`, **from the single page fetch** (no extra
    requests — that previously caused rate-limiting).
  - `fetchYoutubeFeed` has a direct branch for `…/feeds/videos.xml` URLs (fetch as-is,
    no canonicalization) and a `/channel/<id>` branch.
  - `resolveYoutubeChannelUrl(feedUrl)` (used at feed-add time) turns a channel-id
    feed URL into the `@handle` channel page.
  - The metadata UA (Discordbot) gets og data, but YouTube **302-redirects under load**
    → fetch as few pages per share as possible.
- **Reddit** (`providers/reddit.ts`): Reddit **shut down its unauthenticated JSON
  API** (`.json`/`about.json` now 403), so the app reads the public **`.rss` (Atom)**
  feed via the FELFELE UA; `fetchRedditFeed` falls back to a slug name + hardcoded
  favicon when `about.json` is blocked. The JSON helpers (`redditJsonFeedUrl`,
  `parseRedditJson`, `loadRedditFeed`, `about.json`) are **retained** — they work with
  OAuth and are kept for a future authenticated mode.
- **Twitter/X** (`providers/twitter.ts`): routed through nitter; hardcoded X favicon.

---

## 5. Invariants & gotchas (read before editing — each prevents a real regression)

- **`getCanonicalUrl` strips the query string; `normalizeUrl` preserves it**
  (`utils/url.ts`). Never canonicalize a URL whose query is load-bearing — YouTube
  `?channel_id=` and `?v=` die, producing "No RSS feed found" / wrong-channel bugs.
- **`createPost` reads `feedUrl` from its top-level param, not `metadata.feedUrl`.**
  Putting `feedUrl` only inside the metadata object silently drops it → no RSS icon.
- **A feed's unique key is `feedUrl`, not `url`.** Many YouTube channels share
  `https://www.youtube.com/`, so match/route on `feedUrl` (with `url` only as a
  legacy fallback). This is why `/feeds/[...url]` and PostCard route by `feedUrl`.
- **Minimize per-item page fetches to one host.** YouTube rate-limits parallel
  watch-page fetches → 302 → empty metadata → broken posts. Prefer feed/RSS data and
  backfill feed-level fields with `applyDiscoveredFeedDefaults`.
- **`augmentFeedWithMetadata` is best-effort.** Never return `null` (discard a parsed
  feed) because the secondary site fetch failed; resolve the default favicon against
  the **origin**, not a deep feed path (else `…/feeds/videos.xml/favicon.ico` 404s).
- **Metadata UA matters.** `getHeadersForUrl` defaults to Discordbot, which YouTube
  serves og data to — changing it can break previews.
- **Every in-app link and `fetch` must go through `prefix()`.** A hardcoded `/feeds` or
  `fetch('/api/…')` silently drops a `/@bob` session back into single-user mode — and in a
  `fetch` that means reading or writing the wrong user's data.
- **Every persistence call must be passed `locals.user`.** Omitting it is not a type error
  (the param is optional, for single-user mode) — it just reads/writes the root scope.
- **Saving reuses the enriched `previewPost` (post-mode).** Any field you attach at
  save time (tags, `feedUrl`, favicon) must be handled on **both** the post-mode and
  url-mode branches of `POST /api/myfeed`.

---

## 6. Duplication & overlap watchlist (verified; candidates for consolidation)

These exist today and are easy to desync — consolidate when touching them:

- **`redditJsonFeedUrl` defined twice** — `providers/reddit.ts` (exported) and
  `parsers/rss.ts` (internal), with slightly different fallback behavior.
- **MIME-type lists duplicated** — `RSSMimeTypes` + `JsonFeedMimeTypes` in both
  `parsers/rss-post.ts` and `parsers/html-metadata.ts`. Update both or neither.
- **Two YouTube hostname checks** — `providers/youtube.ts`
  (`getHumanHostname === 'youtube.com'`) vs `parsers/html-metadata.ts`
  (`hostname.endsWith('youtube.com')`). Neither handles `youtu.be`, and `endsWith`
  also matches `notyoutube.com`.
- **Overlapping discovery entry points** — `fetchFeedsFromUrl` (generic) vs
  `discoverFeedFromUrl` (info only) vs `discoverAndEnrichFeed` (info + items). Pick
  the narrowest for the job.
- **Multiple Post constructors** — `createPost` (enrich path), `createEnrichedPost`
  (fetch + `createPost`), `convertRSSFeedtoPosts` (builds posts inline, bypassing
  `createPost`), and the deprecated `buildPostFromMetadata`. Behavior can drift
  between the inline builder and `createPost`.
- **Raw `fetch()` instead of `safeFetch`** in `parsers/html-metadata.ts`,
  `parsers/opml.ts`, `post-helpers.ts` (manifest), `utils/opengraph.ts` —
  inconsistent error handling (no `.ok` check).
- **App-side repeats** — feed match-by-`feedUrl`-then-`url` in three places
  (`/feeds/[...url]` page, `/api/feeds/[...url]`, `/share/[...url]` loader);
  tag-collection copied across ~6 loaders (helpers live in `$lib/tags.ts`);
  `discoverFeedFromUrl` can be called up to 4× in one `/api/myfeed` request.
