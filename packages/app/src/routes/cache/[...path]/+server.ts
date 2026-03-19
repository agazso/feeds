import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { RequestHandler } from './$types'

// Resolve cache directory relative to this file's location
// src/routes/cache/[...path] -> packages/app/cache
const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '..', '..', '..', '..', 'cache')

const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.png': 'image/png',
}

export const GET: RequestHandler = async ({ params }) => {
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

  const filePath = join(CACHE_DIR, path)

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
