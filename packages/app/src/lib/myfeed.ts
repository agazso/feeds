import type { Post } from '@feeds/core'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { DATA_DIR } from './paths'

export async function loadMyfeedPosts(): Promise<Post[]> {
  try {
    const filePath = join(DATA_DIR, 'myposts.json')
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return [] // File doesn't exist or is invalid
  }
}
