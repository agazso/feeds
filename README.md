# Feeds

A TypeScript monorepo for RSS/Atom feeds: a self-hostable web reader built on a shared
core library and a command-line interface.

## Overview

The project is organized as three packages:

- **Web App** (`@feeds/app`): a SvelteKit feed reader — a chronological timeline of posts
  from your feeds, with tag suggestions, image caching, and optional authentication.
- **Core Library** (`@feeds/core`): the engine shared by the app and CLI.
- **CLI** (`@feeds/cli`): feed discovery and management from the terminal.

Core capabilities:

- **Feed Discovery**: Automatically discover RSS/Atom feeds from any website URL
- **Feed Parsing**: Parse RSS 2.0, RSS 1.0 (RDF), and Atom feeds
- **OPML Support**: Import and export feed subscriptions in OPML format
- **Metadata Extraction**: Extract OpenGraph and HTML metadata from web pages
- **Provider Support**: Special handling for Reddit and YouTube feeds

## Project Structure

```
feeds/
├── packages/
│   ├── core/           # Core library for feed parsing and utilities
│   │   ├── src/
│   │   │   ├── models/     # Data models (Feed, Post, Author, etc.)
│   │   │   ├── parsers/    # Feed parsers (RSS, Atom, OPML, HTML)
│   │   │   ├── providers/  # Platform-specific handlers (Reddit, YouTube)
│   │   │   └── utils/      # Utility functions (URL, date, fetch, etc.)
│   │   └── tests/
│   ├── cli/            # Command-line interface
│   │   └── src/
│   └── app/            # SvelteKit web app — the feed reader
│       └── src/
│           ├── lib/        # Components, stores, server utilities
│           └── routes/     # Pages and API endpoints
├── pnpm-workspace.yaml # pnpm workspace definition
├── .prettierrc         # Prettier formatting (covers .svelte markup)
├── eslint.config.mjs   # ESLint rules, incl. eslint-plugin-svelte
├── tsconfig.base.json  # Shared TypeScript configuration
└── vitest.workspace.ts # Vitest test configuration
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the content discovery /
enrichment pipeline, the app data flow, and regression-prevention invariants.

## Requirements

- Node.js >= 20.0.0
- pnpm 9.15.0 or later

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd feeds

# Install dependencies
pnpm install
```

## Development

### Build

Build all packages:

```bash
pnpm build
```

Build a specific package:

```bash
pnpm --filter @feeds/core build
pnpm --filter @feeds/cli build
pnpm --filter @feeds/app build
```

### Development Mode

Watch for changes and rebuild:

```bash
pnpm dev
```

### Testing

Run tests:

```bash
pnpm test        # Watch mode
pnpm test:run    # Single run
```

### Type Checking

```bash
pnpm typecheck
```

### Linting and Formatting

```bash
pnpm lint        # Check for issues
pnpm lint:fix    # Fix issues automatically
pnpm format      # Format code
```

### Clean

Remove build artifacts and node_modules:

```bash
pnpm clean
```

## Packages

### @feeds/core

The core library providing feed parsing and utilities.

**Key exports:**

- `fetchFeedsFromUrl(url)` - Discover and fetch feeds from any URL
- `fetchFeedFromUrl(url)` - Fetch a specific feed
- `loadPosts(feeds)` - Load posts from multiple feeds
- `parseOPML(xml)` - Parse OPML subscription lists
- `fetchOpenGraphData(url)` - Extract OpenGraph metadata
- `fetchHtmlMetaDataOnly(url)` - Extract HTML metadata

**Dependencies:**

- `fast-xml-parser` - XML/RSS parsing
- `he` - HTML entity decoding

### @feeds/cli

Command-line interface for feed management.

**Commands:**

```bash
# Discover feeds from a URL
feeds add <url>

# Fetch RSS feed info
feeds rss <url>

# Fetch posts from a feed
feeds fetch-feed <feed-url>

# Fetch posts from a feeds file
feeds fetch <feeds-file> [-m, --max-posts <number>]

# Extract OpenGraph data
feeds opengraph <url>

# Extract HTML metadata
feeds metadata <url>

# Import OPML file or URL
feeds opml-import <file-or-url> [-o, --output <file>]

# Download OPML from URL
feeds opml <url>

# Merge multiple feed files
feeds merge-feeds <files...> [-o, --output <file>]
```

### @feeds/app

A SvelteKit web app — the feed reader UI and its API. It renders a chronological timeline
of posts from your feeds, suggests tags, caches and processes images, and supports
optional authentication for write actions (see [Authentication](#authentication)).

**Run it:**

```bash
pnpm --filter @feeds/app dev      # dev server on http://localhost:1337
pnpm --filter @feeds/app build    # production build (Node adapter → build/)
pnpm --filter @feeds/app preview  # preview the production build
```

Built with `@sveltejs/adapter-node`; the production build runs as `node build/index.js`
and listens on `PORT` (default 3000).

**Configuration (environment variables):**

- `FEEDS_KEYFILE` — path to the write-key file (default: `users.json` beside the data
  dir). It must stay **outside** the data dir: that directory is served publicly.
- `FEEDS_CONFIG` — inline JSON feed configuration
- `FEEDS_CHANNEL` — path to a feed configuration file
- `PORT` — port for the production server (default 3000)

## Usage Examples

### Using the CLI

```bash
# Build the project first
pnpm build

# Discover feeds from a website
pnpm feeds add https://example.com

# Fetch posts from a feed URL
pnpm feeds fetch-feed https://example.com/feed.xml

# Import feeds from an OPML file
pnpm feeds opml-import subscriptions.opml -o feeds.json

# Show help
pnpm feeds --help
```

### Using the Library

```typescript
import { fetchFeedsFromUrl, fetchOpenGraphData, loadPosts } from '@feeds/core'

// Discover feeds from a URL
const feeds = await fetchFeedsFromUrl('https://example.com')

// Load posts from feeds
const posts = await loadPosts(feeds)

// Get OpenGraph data
const ogData = await fetchOpenGraphData('https://example.com/article')
```

## Supported Feed Formats

- RSS 2.0
- RSS 1.0 (RDF)
- Atom
- OPML (for import/export)

## Special Provider Support

### Reddit

Reddit URLs are automatically detected and handled using Reddit's JSON API for better data extraction, including image previews.

### YouTube

YouTube channel and user URLs are converted to their corresponding RSS feed URLs.

## Link aggregators

Feeds like Hacker News or Two Stop Bits carry items that point at other sites, so their
RSS only has the aggregator's own name and icon — every post looks the same. Discovery
detects this (a clear majority of items linking off-site) and pre-ticks **Show enriched
posts** when you add the feed; the feed page then fetches each linked page for its own
title, author and image. You can flip it later with the **Enriched** button on the feed
page. Enriched posts are cached per feed and show up everywhere — the feed's page,
`/all-posts` and `/tags`. A refresh only fetches pages for items it hasn't seen before,
so the cost falls on the first load of a feed rather than on every read.

## Authentication

The web app (`packages/app`) supports optional, cookie-based authentication that gates
all write actions (adding, editing, and removing feeds and posts). It is **disabled by
default**.

- **Enabling it:** create `users.json` **next to** the data dir (`packages/app/users.json`
  by default, or `FEEDS_KEYFILE`) mapping each
  scope to the key that may write in it. The entry named `""` is single-user mode; a
  `"bob"` entry covers `/@bob` (see [Multi-user](#multi-user)). A missing or empty file
  disables authentication and anyone can both read and write.

  ```json
  { "": "my-secret-key", "bob": "bob-secret-key" }
  ```

- **What it protects:** when enabled, reading stays public, but writing requires
  authentication. Enforcement is server-side in `src/hooks.server.ts` — write requests
  (`POST`/`PATCH`/`DELETE`) return `401` when the caller isn't authenticated, and the
  write controls are also hidden in the UI.
- **Signing in:** visit `/auth` and enter a key, or open `/auth?key=YOUR_KEY`. A valid
  key is stored in an httpOnly cookie (`feeds-auth-key`). The `/auth` page shows the
  current status and a **Log out** button, and a settings-menu item mirrors the status
  and links to `/auth`. A key authenticates one scope — sign in again under `/@bob/auth`
  to write there.

## Multi-user

Any path may be prefixed with `/@name`, which scopes everything after it to that user:
`/@bob/myfeed`, `/@bob/feeds`, `/@bob/tags/music`. Without a prefix the app stays in
single-user mode, exactly as before.

- **Creating a user:** open `/invite`, enter a name, and you get a shareable link that
  signs that person in on their device. It creates the `@name` directory and mints their
  key. You can also make the directory by hand (`static/@bob/`) and add a key to
  `users.json` yourself. Nothing else creates a user — an unknown `/@name` path returns
  `404`. Names are lowercase latin letters, digits and underscore; a URL may capitalize
  (`/@Bob`) but resolves to the lowercase folder, so a directory named `@Bob` is not a
  user.
- **Inviting:** `/invite` and `/invite/<name>` display write keys, so unlike every other
  page they are **not** public — they need the root key, in the root scope, and refuse
  outright until `users.json` has a root (`""`) entry. `/invite/<name>` shows an existing
  user's link again, so you can resend one you lost — and if that user has no key yet
  (a directory you made by hand), it mints one. Its `feeds.json`,
  `myposts.json`, and caches live there, and its images under `cache/@bob/`.
- **Listing:** `/users` lists the existing users.
- **Access:** every user is readable by anyone; writes need that user's key from
  `users.json`.

## License

MIT
