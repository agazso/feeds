import type { Feed } from '@feeds/core'
import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { dataDir } from './paths'

export interface AppConfig {
  feeds: Feed[]
  maxPosts: number
}

const DEFAULT_CONFIG: AppConfig = {
  feeds: [],
  maxPosts: 100,
}

async function loadJsonFile(path: string): Promise<AppConfig | null> {
  try {
    const content = await readFile(path, 'utf-8')
    const parsed = JSON.parse(content)
    return {
      feeds: parsed.feeds ?? [],
      maxPosts: parsed.maxPosts ?? DEFAULT_CONFIG.maxPosts,
    }
  } catch {
    return null
  }
}

export async function loadConfig(user?: string): Promise<AppConfig> {
  // A user scope reads only its own dir — the env/cwd overrides below configure
  // single-user mode and would otherwise leak one user's feeds into every scope.
  if (user) {
    return (await loadJsonFile(join(dataDir(user), 'feeds.json'))) ?? DEFAULT_CONFIG
  }

  // Check for FEEDS_CONFIG env (inline JSON)
  const envFeeds = process.env.FEEDS_CONFIG
  if (envFeeds) {
    try {
      const parsed = JSON.parse(envFeeds)
      return {
        feeds: parsed.feeds ?? [],
        maxPosts: parsed.maxPosts ?? DEFAULT_CONFIG.maxPosts,
      }
    } catch {
      console.error('Failed to parse FEEDS_CONFIG env variable')
    }
  }

  // Check for FEEDS_CHANNEL env (path to channel file)
  const channelPath = process.env.FEEDS_CHANNEL
  if (channelPath) {
    const fullPath = isAbsolute(channelPath) ? channelPath : join(process.cwd(), channelPath)
    const config = await loadJsonFile(fullPath)
    if (config) {
      return config
    }
    console.error(`Failed to load channel file: ${fullPath}`)
  }

  // Load from feeds.json in current directory
  const config = await loadJsonFile(join(process.cwd(), 'feeds.json'))
  if (config) {
    return config
  }

  // Load from the data dir (static/feeds.json by default)
  const staticConfig = await loadJsonFile(join(dataDir(), 'feeds.json'))
  return staticConfig ?? DEFAULT_CONFIG
}

export async function saveConfig(config: AppConfig, user?: string): Promise<void> {
  const path = join(dataDir(user), 'feeds.json')
  await writeFile(path, JSON.stringify(config, null, 2))
}

// Match a feed by its unique feedUrl first, falling back to url for older links.
// url is not unique — e.g. many YouTube channels share https://www.youtube.com/.
export function findFeedIndexByKey(feeds: Feed[], key: string): number {
  const byFeedUrl = feeds.findIndex((f) => f.feedUrl === key)
  return byFeedUrl !== -1 ? byFeedUrl : feeds.findIndex((f) => f.url === key)
}

export function findFeedByKey(feeds: Feed[], key: string): Feed | undefined {
  const index = findFeedIndexByKey(feeds, key)
  return index === -1 ? undefined : feeds[index]
}
