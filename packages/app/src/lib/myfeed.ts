import { join } from 'path'
import type { Post } from '@feeds/core'
import { readFile } from 'fs/promises'
import { dataDir } from './paths'

export function myPostsPath(user?: string): string {
  return join(dataDir(user), 'myposts.json')
}

export async function loadMyfeedPosts(user?: string): Promise<Post[]> {
  try {
    const content = await readFile(myPostsPath(user), 'utf-8')
    return JSON.parse(content)
  } catch {
    return [] // File doesn't exist or is invalid
  }
}
