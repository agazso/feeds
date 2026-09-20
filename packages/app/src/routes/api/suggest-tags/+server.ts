import { json } from '@sveltejs/kit'
import { loadConfig } from '$lib/config'
import { getEmbeddingBasedTags } from '$lib/embeddings'
import { loadMyfeedPosts } from '$lib/myfeed'
import { collectAvailableTags } from '$lib/tags'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json()
  const text = body.text?.trim()

  if (!text) {
    return json({ tags: [] })
  }

  try {
    const config = await loadConfig(locals.user)
    const myfeedPosts = await loadMyfeedPosts(locals.user)

    const availableTags = collectAvailableTags(config.feeds, myfeedPosts)

    // Get embedding-based suggestions
    const tags = await getEmbeddingBasedTags(
      text,
      availableTags,
      config.feeds,
      myfeedPosts,
      locals.user,
    )

    return json({ tags })
  } catch (e) {
    console.error('Suggest tags error:', e)
    return json({ tags: [] })
  }
}
