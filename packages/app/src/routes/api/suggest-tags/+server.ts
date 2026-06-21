import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { loadConfig } from '$lib/config'
import { loadMyfeedPosts } from '$lib/myfeed'
import { getEmbeddingBasedTags, collectAvailableTags } from '$lib/tags'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const text = body.text?.trim()

  if (!text) {
    return json({ tags: [] })
  }

  try {
    const config = await loadConfig()
    const myfeedPosts = await loadMyfeedPosts()

    const availableTags = collectAvailableTags(config.feeds, myfeedPosts)

    // Get embedding-based suggestions
    const tags = await getEmbeddingBasedTags(text, availableTags, config.feeds, myfeedPosts)

    return json({ tags })
  } catch (e) {
    console.error('Suggest tags error:', e)
    return json({ tags: [] })
  }
}
