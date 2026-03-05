import type { PageServerLoad } from './$types'
import type { Post } from '@feeds/core'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { transformPostImages } from '$lib/imageEmbed'

export const load: PageServerLoad = async () => {
  const filePath = join(process.cwd(), 'static', 'myposts.json')
  const content = await readFile(filePath, 'utf-8')
  const posts: Post[] = JSON.parse(content)

  // Transform images for display (handle hotlink-blocked CDNs like Twitter)
  const transformedPosts = await Promise.all(
    posts.map((post) => transformPostImages(post, post.link || '')),
  )

  // Add unique suffix to _id to avoid duplicate key errors in Svelte
  const uniqueIdPosts = transformedPosts.map((post) => ({
    ...post,
    _id: `${post._id}-${Math.random().toString(36).slice(2, 8)}`,
  }))

  const sorted = uniqueIdPosts.sort((a, b) => b.createdAt - a.createdAt)

  return { posts: sorted }
}
