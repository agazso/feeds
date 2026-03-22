import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { discoverAndEnrichFeed } from '@feeds/core'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const url = body.url

  if (!url) {
    return json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const result = await discoverAndEnrichFeed(url)
    return json(result)
  } catch (e) {
    console.error('Discover error:', e)
    const message = e instanceof Error ? e.message : 'Failed to discover feed'
    return json({ error: message }, { status: 400 })
  }
}
