import { discoverUrl } from '@feeds/core'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const url = body.url

  if (!url) {
    return json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    // Either one feed with its posts, or a subscription list naming many — the page
    // shows a preview for the first and an import picker for the second.
    const result = await discoverUrl(url)
    return json(result)
  } catch (e) {
    console.error('Discover error:', e)
    const message = e instanceof Error ? e.message : 'Failed to discover feed'
    return json({ error: message }, { status: 400 })
  }
}
