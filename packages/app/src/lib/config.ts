import type { Feed } from '@feeds/core'
import { readFile } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'

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

export async function loadConfig(): Promise<AppConfig> {
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
  return config ?? DEFAULT_CONFIG
}
