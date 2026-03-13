import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { getEmbeddingBasedTags, getTagsFromPosts } from '$lib/tags'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const text = body.text?.trim()

  if (!text) {
    return json({ tags: [] })
  }

  try {
    const config = await loadConfig()
    const myfeedPosts = await loadMyfeedPosts()

    // Build available tags set
    const tagSet = new Set<string>()
    for (const feed of config.feeds) {
      if (feed.tags) {
        for (const tag of feed.tags) {
          tagSet.add(tag)
        }
      }
    }
    for (const tag of getTagsFromPosts(myfeedPosts)) {
      tagSet.add(tag)
    }

    const availableTags = Array.from(tagSet)

    // Get embedding-based suggestions
    const tags = await getEmbeddingBasedTags(text, availableTags, config.feeds, myfeedPosts)

    return json({ tags })
  } catch (e) {
    console.error('Suggest tags error:', e)
    return json({ tags: [] })
  }
}
