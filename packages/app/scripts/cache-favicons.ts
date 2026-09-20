import type { Post } from '@feeds/core'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { processFavicon } from '../src/lib/server/imageProcessing'

async function main() {
  const filePath = join(process.cwd(), 'static', 'myposts.json')
  const content = await readFile(filePath, 'utf-8')
  const posts: Post[] = JSON.parse(content)

  let updated = 0
  for (const post of posts) {
    // Skip if no author image, already cached, or is a data URI
    if (!post.author?.image?.uri) continue
    if (post.author.image.cacheHash) continue
    if (post.author.image.uri.startsWith('data:')) continue

    const result = await processFavicon(post.author.image.uri)
    if (result) {
      post.author.image.cacheHash = result.cacheHash
      updated++
      console.log(`Cached: ${post.author.name} -> ${result.cacheHash.slice(0, 8)}...`)
    }
  }

  await writeFile(filePath, JSON.stringify(posts, null, 4))
  console.log(`Done. Updated ${updated} posts.`)
}

main()
