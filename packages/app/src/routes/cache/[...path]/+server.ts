import { readFile } from 'fs/promises'
import { join } from 'path'
import { cacheDir } from '$lib/paths'
import type { RequestHandler } from './$types'

const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.png': 'image/png',
}

export const GET: RequestHandler = async ({ params, locals }) => {
  const path = params.path

  if (!path) {
    return new Response('Not found', { status: 404 })
  }

  // Validate: no directory traversal
  if (path.includes('..')) {
    return new Response('Not found', { status: 404 })
  }

  // Check for allowed extension
  const ext = Object.keys(ALLOWED_EXTENSIONS).find((e) => path.endsWith(e))
  if (!ext) {
    return new Response('Not found', { status: 404 })
  }

  const filePath = join(cacheDir(locals.user), path)

  try {
    const file = await readFile(filePath)

    return new Response(file, {
      headers: {
        'Content-Type': ALLOWED_EXTENSIONS[ext],
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
