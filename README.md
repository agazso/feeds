# Feeds

A TypeScript monorepo for RSS/Atom feed parsing, discovery, and management.

## Overview

This project provides tools for working with RSS and Atom feeds:

- **Feed Discovery**: Automatically discover RSS/Atom feeds from any website URL
- **Feed Parsing**: Parse RSS 2.0, RSS 1.0 (RDF), and Atom feeds
- **OPML Support**: Import and export feed subscriptions in OPML format
- **Metadata Extraction**: Extract OpenGraph and HTML metadata from web pages
- **Provider Support**: Special handling for Reddit and YouTube feeds

## Project Structure

```
feeds2/
├── packages/
│   ├── core/           # Core library for feed parsing and utilities
│   │   ├── src/
│   │   │   ├── models/     # Data models (Feed, Post, Author, etc.)
│   │   │   ├── parsers/    # Feed parsers (RSS, Atom, OPML, HTML)
│   │   │   ├── providers/  # Platform-specific handlers (Reddit, YouTube)
│   │   │   └── utils/      # Utility functions (URL, date, fetch, etc.)
│   │   └── tests/
│   └── cli/            # Command-line interface
│       └── src/
├── apps/               # Applications (placeholder)
├── biome.json          # Biome linter/formatter configuration
├── tsconfig.base.json  # Shared TypeScript configuration
└── vitest.workspace.ts # Vitest test configuration
```

## Requirements

- Node.js >= 20.0.0
- pnpm 9.15.0 or later

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd feeds2

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
import {
  fetchFeedsFromUrl,
  loadPosts,
  fetchOpenGraphData,
} from '@feeds/core'

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

## License

MIT
