import { readFileSync, writeFileSync } from 'node:fs'
import {
  type Feed,
  type Post,
  convertOPMLFeed,
  discoverFeedUrlFromWellKnownPaths,
  fetchEnrichedMetadata,
  fetchFeedFromUrl,
  fetchFeedsFromUrl,
  fetchHtmlMetaDataOnly,
  fetchOpenGraphData,
  getBaseUrl,
  getCanonicalUrl,
  loadPosts,
  mergeUpdatedPosts,
  readOPML,
  tryFetchOPML,
} from '@feeds/core'
import { Command } from 'commander'

const program = new Command()

program.name('feeds').description('CLI for RSS feed management and publishing').version('0.1.0')

// RSS command - fetch RSS feed from URL
program
  .command('rss <url>')
  .description('Fetch RSS feed info from URL')
  .action(async (url: string) => {
    const canonicalUrl = getCanonicalUrl(url)
    const feed = await fetchFeedFromUrl(canonicalUrl)
    console.log(JSON.stringify(feed, null, 2))
  })

// Add feed command - discover feeds from URL
program
  .command('add <url>')
  .description('Discover and add feed from URL')
  .action(async (url: string) => {
    const feeds = await fetchFeedsFromUrl(url)
    console.log(JSON.stringify(feeds, null, 2))
  })

// OpenGraph command
program
  .command('opengraph <url>')
  .description('Fetch OpenGraph data from URL')
  .action(async (url: string) => {
    const data = await fetchOpenGraphData(url)
    console.log(JSON.stringify(data, null, 2))
  })

// Metadata command
program
  .command('metadata <url>')
  .description('Fetch HTML metadata from URL')
  .action(async (url: string) => {
    const data = await fetchHtmlMetaDataOnly(url)
    console.log(JSON.stringify(data, null, 2))
  })

// Discover command - comprehensive metadata with feed discovery
program
  .command('discover <url>')
  .description('Fetch all metadata including feed discovery from well-known paths')
  .action(async (url: string) => {
    const { metadata } = await fetchEnrichedMetadata(url)

    // Try to discover feed using the same logic as the web app
    const feedResult = await fetchFeedsFromUrl(url)
    if (feedResult) {
      const feed = Array.isArray(feedResult) ? feedResult[0] : feedResult
      if (feed) {
        // Use feed name if available and more specific than the generic site name
        // (e.g., "The Cobwebs Channel" is better than "YouTube")
        if (feed.name && feed.name !== metadata.siteName) {
          metadata.name = feed.name
        }
        if (feed.feedUrl) {
          metadata.feedUrl = feed.feedUrl
        }
        // Store the page URL (important for YouTube channels)
        if (feed.url) {
          metadata.url = feed.url
        }
        if (feed.favicon && typeof feed.favicon === 'string') {
          metadata.icon = metadata.icon || feed.favicon
        }
      }
    }

    // If still no feedUrl found in metadata, try well-known paths
    if (!metadata.feedUrl) {
      const baseUrl = getBaseUrl(url)
      const discoveredFeedUrl = await discoverFeedUrlFromWellKnownPaths(baseUrl)
      if (discoveredFeedUrl) {
        metadata.feedUrl = discoveredFeedUrl
      }
    }

    console.log(JSON.stringify(metadata, null, 2))
  })

// OPML command
program
  .command('opml <url>')
  .description('Download and convert OPML data')
  .action(async (url: string) => {
    const data = await tryFetchOPML(url)
    console.log(JSON.stringify(data, null, 2))
  })

// Fetch feeds from file
program
  .command('fetch <feeds-file>')
  .description('Fetch posts from feeds file')
  .option('-m, --max-posts <number>', 'Maximum number of posts', '20')
  .action(async (feedsFile: string, options: { maxPosts: string }) => {
    const feedsData = readFileSync(feedsFile, { encoding: 'utf-8' })
    const feedsObj = JSON.parse(feedsData)
    const feeds = feedsObj.feeds as Feed[]
    const allPosts = await loadPosts(feeds)
    const posts = mergeUpdatedPosts(allPosts, [])
    const maxPosts = Number.parseInt(options.maxPosts, 10) || 20
    const topPosts = posts.slice(0, maxPosts)
    console.log(JSON.stringify(topPosts, null, 2))
  })

// Fetch single feed
program
  .command('fetch-feed <feed-url>')
  .description('Fetch posts from a single feed URL')
  .action(async (url: string) => {
    const feed: Feed = {
      name: '',
      url,
      feedUrl: url,
      favicon: '',
    }
    const posts = await loadPosts([feed])
    console.log(JSON.stringify(posts, null, 2))
  })

// Merge feeds command
program
  .command('merge-feeds <files...>')
  .description('Merge multiple feed files')
  .option('-o, --output <file>', 'Output file')
  .action(async (files: string[], options: { output?: string }) => {
    let allFeeds: Feed[] = []
    for (const file of files) {
      const feedsData = readFileSync(file, { encoding: 'utf-8' })
      const feedsObj = JSON.parse(feedsData)
      const feeds = feedsObj.feeds as Feed[]
      allFeeds = allFeeds.concat(feeds)
    }
    const result = JSON.stringify({ feeds: allFeeds }, null, 2)
    if (options.output) {
      writeFileSync(options.output, result)
      console.log(`Merged ${allFeeds.length} feeds to ${options.output}`)
    } else {
      console.log(result)
    }
  })

// OPML import command
program
  .command('opml-import <file-or-url>')
  .description('Import feeds from OPML file or URL')
  .option('-o, --output <file>', 'Output file')
  .action(async (input: string, options: { output?: string }) => {
    let xml: string
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const response = await fetch(input)
      xml = await response.text()
    } else {
      xml = readFileSync(input, { encoding: 'utf-8' })
    }
    const opmlFeeds = await readOPML(xml)
    const feeds: Feed[] = []
    for (const opmlFeed of opmlFeeds) {
      const feed = await convertOPMLFeed(opmlFeed)
      if (feed) {
        feeds.push(feed)
        console.error(`Imported: ${feed.name} - ${feed.feedUrl}`)
      }
    }
    const result = JSON.stringify({ feeds }, null, 2)
    if (options.output) {
      writeFileSync(options.output, result)
      console.log(`Imported ${feeds.length} feeds to ${options.output}`)
    } else {
      console.log(result)
    }
  })

program.parse()
