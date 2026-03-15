import { encode } from 'blurhash'
import sharp from 'sharp'
import { createHash } from 'crypto'
import { mkdir, writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Resolve cache directory relative to this file's location
// src/lib/server -> packages/app/cache
const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '..', '..', '..', 'cache')

const BLURHASH_WIDTH = 32
const BLURHASH_HEIGHT = 32
const BLURHASH_COMPONENTS_X = 4
const BLURHASH_COMPONENTS_Y = 3

export interface ImageProcessingResult {
  blurhash: string
  aspectRatio: number
  cacheHash?: string // undefined if caching failed
}

/**
 * Process an image: generate blurhash, calculate aspect ratio, and cache as WebP.
 * Returns undefined if processing fails entirely (e.g., network error, invalid image).
 * Individual operations (blurhash, caching) may fail independently.
 */
export async function processImage(imageUrl: string): Promise<ImageProcessingResult | undefined> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/2.0)',
      },
    })

    if (!response.ok) {
      return undefined
    }

    const buffer = await response.arrayBuffer()
    const imageBuffer = Buffer.from(buffer)
    const sharpImage = sharp(imageBuffer)

    // Get original dimensions BEFORE resizing
    const metadata = await sharpImage.metadata()
    if (!metadata.width || !metadata.height) {
      return undefined
    }

    const aspectRatio = metadata.width / metadata.height

    // Generate blurhash
    let blurhash: string
    try {
      const { data, info } = await sharp(imageBuffer)
        .resize(BLURHASH_WIDTH, BLURHASH_HEIGHT, { fit: 'cover' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      blurhash = encode(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
        BLURHASH_COMPONENTS_X,
        BLURHASH_COMPONENTS_Y,
      )
    } catch {
      return undefined
    }

    // Cache the image as WebP
    let cacheHash: string | undefined
    try {
      cacheHash = await cacheImageAsWebP(imageBuffer)
    } catch (e) {
      console.warn('Image caching failed:', e)
      // Continue without cache - blurhash is still useful
    }

    return {
      blurhash,
      aspectRatio,
      cacheHash,
    }
  } catch {
    return undefined
  }
}

/**
 * Convert image to WebP, calculate SHA256 hash, and save to cache folder.
 * Returns the hash on success, undefined on failure.
 */
async function cacheImageAsWebP(imageBuffer: Buffer): Promise<string | undefined> {
  // Resize to max 560px width (preserve aspect ratio, don't upscale) and convert to WebP
  const webpBuffer = await sharp(imageBuffer)
    .resize({ width: 560, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  // Calculate SHA256 hash
  const hash = createHash('sha256').update(webpBuffer).digest('hex')

  // Create cache folder structure: /cache/[hex[0]]/[hex[1]]/
  const cacheDir = join(CACHE_DIR, hash[0], hash[1])
  await mkdir(cacheDir, { recursive: true })

  // Save the WebP file
  const cachePath = join(cacheDir, `${hash}.webp`)
  await writeFile(cachePath, webpBuffer)

  return hash
}

/**
 * Delete a cached image by its hash.
 * Logs a warning if deletion fails (file may not exist).
 */
export async function deleteCachedImage(cacheHash: string): Promise<void> {
  const cachePath = join(CACHE_DIR, cacheHash[0], cacheHash[1], `${cacheHash}.webp`)
  try {
    await unlink(cachePath)
  } catch (e) {
    console.warn('Cache file deletion failed:', e)
  }
}

// Re-export generateBlurhash for backward compatibility
export { processImage as generateBlurhash }
