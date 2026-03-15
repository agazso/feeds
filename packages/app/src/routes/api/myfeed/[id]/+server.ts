import type { RequestHandler } from './$types'
import { json } from '@sveltejs/kit'
import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { getAllTags, getTagsFromPosts } from '$lib/tags'

export const GET: RequestHandler = async ({ params }) => {
  const postId = decodeURIComponent(params.id)
  const posts = await loadMyfeedPosts()
  const post = posts.find(p => p._id === postId)

  if (!post) {
    return json({ error: 'Post not found' }, { status: 404 })
  }

  const config = await loadConfig()
  const feedTags = getAllTags(config.feeds)
  const myfeedTags = getTagsFromPosts(posts)
  const availableTags = [...new Set([...feedTags, ...myfeedTags])].sort()

  return json({ post, availableTags })
}
