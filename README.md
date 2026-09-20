# Feeds

A self-hostable feed reader that stays quiet. It follows RSS, Atom and JSON feeds —
plus YouTube channels, subreddits and a few other sites that never published one —
pulls each item up to a readable post, and shows them as a single chronological
timeline. No counts, no badges, no algorithm.

The whole thing is a TypeScript monorepo: a SvelteKit web app, the engine it runs on as
a reusable library, and a CLI over the same engine.

## Features

### A UI that doesn't keep score

There are no unread counts, no item totals, no list lengths, no badges. That is a
deliberate design rule, not an oversight — the point is to make reading feel finishable
rather than owed. What's left is the posts: a chronological timeline, a search box, and
a tag filter. Dark by default with a light toggle, and a masonry or single-column
layout — both remembered in a cookie, so a fresh device renders right on the server.

### Discovery, and enrichment for link aggregators

Point it at a site's ordinary homepage — `https://example.com`, not the feed URL. It
fetches the page, reads `<link rel="alternate">`, falls back to sniffing well-known
locations (`/feed`, `/rss.xml`, `/index.xml`, …), and works out the feed's name and
icon along the way. You see a preview of the real posts before deciding to follow it.

Feeds like Hacker News or Two Stop Bits are a different problem: their items point at
_other_ sites, so the feed itself only carries the aggregator's name and icon and every
post looks identical. Discovery detects that — a clear majority of items linking
off-site — and pre-ticks **Show enriched posts**. The feed page then fetches each linked
page for its own title, author and image, while keeping a link back to the discussion
thread. Enriched posts are cached per feed and appear everywhere the plain ones do; a
refresh only fetches pages for items it hasn't seen, so the cost lands on a feed's first
load rather than on every read.

### Formats and providers

Parsers for **RSS 2.0**, **RSS 1.0 (RDF)**, **Atom** and **JSON Feed**, with **OPML**
for bulk import and export.

Several sites need more than a parser, so they get dedicated handling:

| Provider        | What it does                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **YouTube**     | Channel, user, `@handle` and watch URLs resolve to the channel feed. A watch page yields the channel name and id from a single fetch, because YouTube rate-limits. |
| **Reddit**      | Subreddit and post URLs read the public `.rss` feed (the unauthenticated JSON API is gone), with image previews pulled out of the entry content.                   |
| **X / Twitter** | Routed through a nitter instance.                                                                                                                                  |
| **Shazam**      | Song links resolve to track metadata and cover art.                                                                                                                |

### Tagging and filtering

Tags live on feeds and on individual saved posts. `/tags/music` shows one,
`/tags/music+guitar` intersects several, and the tag editor suggests tags two ways: from
which tags you already use together, and from the post's own text via a local sentence
embedding model (`all-MiniLM-L6-v2`, run in-process — nothing is sent anywhere). Search
is a word-prefix match across a post's text, tags, author and URL, with `-word` to
exclude.

### Saving posts to My Feed

Share or paste any link and it becomes a post of your own: the page is fetched for its
title, author, image and publication date, and you can tag it before saving. Saved
posts' images and avatars are re-encoded to WebP, given a blurhash placeholder, and
stored in a content-addressed local cache, so a saved post keeps working after the
original page changes.

### Multiple users

Any path may be prefixed with `/@name` — `/@bob/myfeed`, `/@bob/tags/music` — scoping
feeds, saved posts and caches to that person's own directory. Without a prefix the app
behaves as a single-user install. Reading is public; writing takes that scope's key.
See [Multi-user](#multi-user).

### Your feeds, back out as feeds

Every page that lists posts is itself subscribable — append `.rss` or `.json` (JSON
Feed) to its URL:

| Page           | Feed                                    |
| -------------- | --------------------------------------- |
| `/myfeed`      | `/myfeed.rss`, `/myfeed.json`           |
| `/all-posts`   | `/all-posts.rss`, `/all-posts.json`     |
| `/tags/music`  | `/tags/music.rss`, `/tags/music.json`   |
| `/feeds/<url>` | `/feeds.rss/<url>`, `/feeds.json/<url>` |

The last one is the interesting one: for an enriched feed it hands you the version the
source can't — each item carrying the linked article's own title, author and image, with
the aggregator's discussion link in `<comments>` / `external_url`. Every page advertises
its feeds with `<link rel="alternate">`, so a reader finds them on its own. Under a user
prefix the feeds are scoped too, which makes `/@bob/tags/music.rss` a shareable slice of
someone's reading.

### A CLI and a library

The same engine ships three ways. `@feeds/core` is a plain ESM library you can import —
discovery, parsing, enrichment, OPML, metadata extraction, no disk access and no
framework. `@feeds/cli` puts it on the command line for scripting and one-off
inspection. The web app adds only persistence, caching, auth and UI on top.

### Feed content is never trusted

Feed descriptions arrive as arbitrary HTML from sites you don't control. It is converted
to Markdown — tags stripped, links and images kept as Markdown — and rendered as text;
the app uses no raw-HTML rendering anywhere, so a feed cannot inject markup or script
into a page. Generated feeds escape their output, cached images are stored under a
content hash rather than any name the remote supplied, and a `/@name` scope is
restricted to `[a-z0-9_]` so a path can never escape the data directory.

## Installation

Requirements: **Node.js >= 20** and **pnpm 9.15** or later.

```bash
git clone <repository-url>
cd feeds
pnpm install
pnpm build
```

Run the reader in development, on http://localhost:1337:

```bash
pnpm --filter @feeds/app dev
```

Or build and run it for real. The app uses `@sveltejs/adapter-node`, so the production
build is a plain Node server listening on `PORT` (default 3000):

```bash
pnpm --filter @feeds/app build
node packages/app/build/index.js
```

Feeds and saved posts are written to `packages/app/static/` as JSON, and cached images
to `packages/app/cache/` — back those up and you have backed up everything. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for a server deployment.

### Configuration

| Variable         | Purpose                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`           | Port for the production server (default `3000`).                                                                                        |
| `FEEDS_DATA_DIR` | Where feeds, posts and per-user directories live (default `static/`).                                                                   |
| `FEEDS_KEYFILE`  | Path to the write-key file (default `users.json` beside the data dir). It must stay **outside** the data dir, which is served publicly. |
| `FEEDS_CONFIG`   | Inline JSON feed configuration.                                                                                                         |
| `FEEDS_CHANNEL`  | Path to a feed configuration file.                                                                                                      |

### Authentication

Optional and **off by default**: with no key file, anyone can read and write. Enabling it
gates every write (adding, editing and removing feeds and posts) while reading stays
public.

Create `users.json` **next to** the data dir (`packages/app/users.json` by default, or
`FEEDS_KEYFILE`), mapping each scope to the key that may write in it. The entry named
`""` is single-user mode; a `"bob"` entry covers `/@bob`:

```json
{ "": "my-secret-key", "bob": "bob-secret-key" }
```

Enforcement is server-side in `src/hooks.server.ts` — `POST`/`PATCH`/`DELETE` return
`401` when the caller isn't authenticated, and the write controls are hidden in the UI
as well. To sign in, visit `/auth` and enter a key, or open `/auth?key=YOUR_KEY`; a valid
key is stored in an httpOnly cookie. A key authenticates one scope, so sign in again
under `/@bob/auth` to write there.

### Multi-user

- **Creating a user:** open `/invite`, enter a name, and you get a shareable link that
  signs that person in on their device — it creates the `@name` directory and mints
  their key. You can also make the directory by hand (`static/@bob/`) and add a key to
  `users.json` yourself. Nothing else creates a user; an unknown `/@name` returns `404`.
  Names are lowercase latin letters, digits and underscore. A URL may capitalize
  (`/@Bob`) but resolves to the lowercase folder, so a directory named `@Bob` is not a
  user.
- **Inviting:** `/invite` and `/invite/<name>` display write keys, so unlike every other
  page they are **not** public — they need the root key, in the root scope, and refuse
  outright until `users.json` has a root (`""`) entry. `/invite/<name>` shows an existing
  user's link again so you can resend one, and mints a key for a directory you made by
  hand.
- **Where it lives:** a user's `feeds.json`, `myposts.json` and caches sit under their
  own directory, images under `cache/@bob/`.
- **Listing:** `/users` lists the existing users.

## Packages

### `@feeds/core`

The engine: discovery, parsing, enrichment and post building. Pure logic — network via
`fetch`, no disk access. Depends only on `fast-xml-parser` and `he`.

```typescript
import { fetchFeedsFromUrl, fetchOpenGraphData, loadPosts } from '@feeds/core'

const feeds = await fetchFeedsFromUrl('https://example.com')
const posts = await loadPosts(feeds)
const og = await fetchOpenGraphData('https://example.com/article')
```

Key exports: `fetchFeedsFromUrl`, `fetchFeed`, `loadPosts`, `discoverFeedFromUrl`,
`discoverAndEnrichFeed`, `createEnrichedPost`, `parseOPML`, `fetchOpenGraphData`,
`fetchHtmlMetaDataOnly`.

### `@feeds/cli`

```bash
pnpm feeds add <url>                      # discover a feed from any URL
pnpm feeds rss <url>                      # fetch feed info
pnpm feeds discover <url>                 # metadata incl. well-known path search
pnpm feeds discover-feed <url>            # discover, then enrich every item
pnpm feeds fetch-feed <feed-url>          # posts from one feed
pnpm feeds fetch <feeds-file> [-m <n>]    # posts from a feeds file
pnpm feeds opengraph <url>                # OpenGraph data
pnpm feeds metadata <url>                 # HTML metadata
pnpm feeds opml <url>                     # download and convert OPML
pnpm feeds opml-import <file-or-url> [-o <file>]
pnpm feeds merge-feeds <files...> [-o <file>]
pnpm feeds --help
```

### `@feeds/app`

The SvelteKit reader: routes, API endpoints, persistence, image processing and auth. It
never re-implements parsing or discovery — it calls core.

## Project structure

```
feeds/
├── packages/
│   ├── core/           # The engine
│   │   ├── src/
│   │   │   ├── models/     # Feed, Post, Author, RSS types
│   │   │   ├── parsers/    # RSS, Atom, JSON Feed, OPML, HTML metadata
│   │   │   ├── providers/  # YouTube, Reddit, X/Twitter, Shazam
│   │   │   └── utils/      # URL, date, fetch, favicon, HTML helpers
│   │   └── tests/
│   ├── cli/            # Command-line interface
│   └── app/            # SvelteKit web app
│       └── src/
│           ├── lib/        # Components, stores, server utilities
│           └── routes/     # Pages, API endpoints and generated feeds
├── docs/               # Architecture, deployment, cleanup notes
├── pnpm-workspace.yaml
├── .prettierrc         # Formatting, incl. .svelte markup
├── eslint.config.mjs   # Lint rules, incl. eslint-plugin-svelte
├── tsconfig.base.json
└── vitest.workspace.ts
```

## Contributing

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing feed discovery,
parsing or post enrichment. It maps the pipeline and lists the invariants in §5 that
have each already caused a regression once — the `getCanonicalUrl` / `normalizeUrl`
split, why a feed's key is its `feedUrl`, why per-item fetches to one host must stay
rare. [AGENTS.md](AGENTS.md) carries the same conventions for coding agents.

```bash
pnpm build                 # all packages
pnpm dev                   # watch and rebuild
pnpm test                  # vitest, watch mode
pnpm test:run              # single run
pnpm typecheck             # tsc across packages
pnpm lint                  # prettier --check and eslint
pnpm lint:fix              # fix both
pnpm --filter @feeds/app check   # svelte-check
```

A few house rules:

- Anything non-trivial in the pipeline gets a test. Both packages use Vitest; look at
  `packages/core/tests/` for the shape.
- The UI shows no counts, totals or badges. That is a product decision — see
  [Features](#a-ui-that-doesnt-keep-score).
- ESM `import` everywhere, in source, scripts and one-off checks. Prefer `const`.
- Conventional commits, lowercase and imperative: `fix: show share URL input on iOS
Safari`. One commit per change, subject only unless the _why_ isn't obvious from the
  diff.

## License

MIT — see [LICENSE](LICENSE).
