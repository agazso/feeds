# Cleanup plan: low-hanging duplications

Targets the **low-risk, high-value** duplications listed in
[ARCHITECTURE.md §6](ARCHITECTURE.md). Each item is a mechanical de-duplication with
**no behavior change** (the one exception is a tiny correctness fix, called out
below). Riskier items that change behavior or need a design decision are listed under
"Deferred" and are **not** part of this cleanup.

Status: items 1–5 **done**; B subsumed below.

## Progress (resume here)

**Done:**

- Items **1–5** (MIME module, `isYoutubeUrl`, dead-code removal, `collectAvailableTags`,
  `findFeedByKey`).
- Item **B** — `redditJsonFeedUrl` unified into one robust impl; the survivor is kept
  (unused by the active path) for a future authenticated Reddit mode.
- **Reddit JSON→RSS migration** — Reddit shut down its unauthenticated JSON API (403).
  `fetchFeed` now reads the public `.rss` (Atom) feed; `fetchRedditFeed` falls back to a
  slug name + hardcoded favicon when `about.json` is blocked. JSON helpers
  (`redditJsonFeedUrl`, `parseRedditJson`, `loadRedditFeed`) retained for OAuth later.
- **Reddit Atom image extraction** — `parsers/atom.ts` `getImageFromAtomContent` pulls
  the post image out of the entry `<content>` HTML (he-decoded), scoped to `redd.it`
  so no other Atom feed changes.
- **Dev-build race fix** — `packages/app/vite.config.ts` aliases `@feeds/core` to its
  TS source in dev (see ARCHITECTURE/this file's tail), removing the tsup-`dist` race
  that caused intermittent 500s.
- 83 core tests green.

**Pending:**

- Item **C** — `/api/myfeed` POST calls `discoverFeedFromUrl` up to 2× in url-mode
  (feedUrl + favicon fallbacks); memoize to call once.
- Item **E** — `fetchYoutubeFeed` `/channel/<id>` branch still sets `feed.url` to the
  videos.xml self-link; apply the same `resolveYoutubeChannelUrl` fix already done for
  the `/feeds/videos.xml` branch.

**New future item (not in the original list):**

- `parseAtomFeed` description bug — it reads `content[0]?._` but the parser stores text
  under `_text`, so Atom **descriptions** are dropped entirely (images are now handled
  separately via `getImageFromAtomContent`). Fixing it would restore descriptions for
  all Atom feeds — and re-introduce Reddit "submitted by …" chrome — so it needs its
  own pass.

> **Note (Reddit, June 2026):** Reddit shut down its unauthenticated JSON API
> (`.json`/`about.json` → 403). The app now reads the public **`.rss` (Atom)** feed
> (`fetchFeed` parses Atom; `fetchRedditFeed` falls back to a slug name + hardcoded
> favicon). The JSON helpers (`redditJsonFeedUrl`, `parseRedditJson`,
> `loadRedditFeed`) are **retained for a future OAuth mode** — do not delete. This
> also closes cleanup item B (the two `redditJsonFeedUrl` copies were unified; the
> survivor is now unused by the active path but kept on purpose).

---

## 1. Single source for feed MIME types

**Problem.** `RSSMimeTypes` and `JsonFeedMimeTypes` are defined twice, byte-identical:
`parsers/rss-post.ts:20,28` and `parsers/html-metadata.ts:8,16`. Update one and they
silently desync. The `isRssMimeType` / `isJsonFeedMimeType` / `isFeedMimeType` helpers
exist only in `rss-post.ts` and are not referenced by `@feeds/app` or `@feeds/cli`.

**Change.**

- Add `packages/core/src/parsers/mime.ts` exporting `RSSMimeTypes`,
  `JsonFeedMimeTypes`, `allFeedMimeTypes`, and the three `is*MimeType` helpers.
- `rss-post.ts` and `html-metadata.ts` import from `./mime` and delete their local
  copies.
- Add `export * from './mime'` to `parsers/index.ts` so the public names stay exported.

**Risk.** None — identical constants, no behavior change.

---

## 2. One YouTube hostname predicate (includes a small correctness fix)

**Problem.** Two different YouTube hostname checks:

- `providers/youtube.ts` `isYoutubeLink` → `getHumanHostname(getCanonicalUrl(url)) === 'youtube.com'` (correct).
- `parsers/html-metadata.ts:106` `getYoutubeWatchInfo` → `hostname.endsWith('youtube.com')`,
  which **also matches `notyoutube.com`** (a latent bug). Neither handles `youtu.be`.

**Change.**

- Add to `utils/url.ts` (next to the existing `isXUrl` / `isRedditUrl`):
  ```ts
  export function isYoutubeUrl(url: string): boolean {
    return getHumanHostname(getCanonicalUrl(url)) === 'youtube.com'
  }
  ```
  This is exactly the current `isYoutubeLink` behavior.
- `providers/youtube.ts`: `isYoutubeLink` delegates to it (keep the exported name —
  it's used widely).
- `parsers/html-metadata.ts`: `getYoutubeWatchInfo` uses `isYoutubeUrl(url)` instead of
  the inline `endsWith` check. No import cycle — `utils` is the base layer.

**Risk.** Low. `isYoutubeLink` behavior is unchanged (delegates to an identical
expression). The only behavior change is `getYoutubeWatchInfo` no longer false-positives
on `notyoutube.com`. `youtu.be` support is intentionally **not** added here (separate
enhancement).

---

## 3. Remove deprecated dead code

**Problem.** `buildPostFromMetadata` (`post-helpers.ts:187-194`, marked `@deprecated`)
has **no callers** anywhere in the repo.

**Change.** Delete the function.

**Risk.** None internally. (It is exported from `@feeds/core`; removing a deprecated,
unused export is acceptable but is technically a public-API removal — flagged for
awareness.)

---

## 4. Shared tag-collection helper (app)

**Problem.** The same block — collect `feed.tags` across `config.feeds`, add
`getTagsFromPosts(myfeedPosts)`, dedupe — is copy-pasted in four loaders:
`routes/share/[...url]/+page.server.ts`, `routes/discover/[...url]/+page.server.ts`,
`routes/feeds/[...url]/+page.server.ts`, `routes/api/suggest-tags/+server.ts`.

**Change.**

- Add `collectAvailableTags(feeds, posts)` to `$lib/tags.ts`, implemented with the
  existing `getAllTags(feeds)` + `getTagsFromPosts(posts)` (sorted, deduped).
- Replace the four inline blocks with one call.

**Risk.** None — pure refactor. (`suggest-tags` currently skips sorting; sorted output
is harmless there.)

---

## 5. Shared feed-lookup helper (app)

**Problem.** The "match by `feedUrl`, fall back to `url`" rule (an important invariant —
see ARCHITECTURE.md §5) is hand-written in two places:
`routes/feeds/[...url]/+page.server.ts:21` and `routes/api/feeds/[...url]/+server.ts:24`.

**Change.**

- Add `findFeedByKey(feeds, key)` to `$lib/config.ts`:
  `feeds.find(f => f.feedUrl === key) ?? feeds.find(f => f.url === key)`.
- Use it in both sites (PATCH derives its index from the returned feed, or add a
  sibling `findFeedIndexByKey`).

**Risk.** None — pure refactor. The `/share` loader matches `feedUrl` only (different
intent) and is left untouched.

---

## Deferred (not low-hanging — out of scope here)

- **Raw `fetch()` → `safeFetch`** in `html-metadata.ts`, `opml.ts`, `post-helpers.ts`,
  `opengraph.ts`. `safeFetch` throws on non-2xx; these call sites rely on graceful
  handling (e.g. manifest probing, 3xx pages) → behavior change, needs per-site review.
- **`redditJsonFeedUrl` defined twice** (`providers/reddit.ts` vs `parsers/rss.ts`) —
  the two versions differ for non-`.rss`/`.json` URLs → needs a behavior decision before
  merging.
- **`/api/myfeed` calls `discoverFeedFromUrl` up to 4× per request** → perf/logic change,
  not a pure refactor.
- **Unifying the Post constructors** (`createPost` / `createEnrichedPost` /
  `convertRSSFeedtoPosts`) → architectural.
- **`/channel/<id>` branch in `fetchYoutubeFeed`** has the same channel-URL issue just
  fixed for the `/feeds/videos.xml` branch → belongs with a channel-URL consolidation.

---

## Verification (when executed)

- New unit test for `isYoutubeUrl` (`tests/utils/url.test.ts`): true for
  `www.youtube.com` / `m.youtube.com`, false for `notyoutube.com` / `example.com`.
- `pnpm --filter @feeds/core test` — the existing 72 tests exercise MIME detection,
  YouTube discovery, and post building, so they guard items 1–3 — then
  `pnpm --filter @feeds/core build`.
- `pnpm --filter @feeds/app exec svelte-check` — guards items 4–5.
- Sanity greps: one `RSSMimeTypes = [` in core; no `buildPostFromMetadata`; no
  `endsWith('youtube.com')`.
- App smoke: discover a YouTube feed; tags/feeds/share pages render unchanged.
