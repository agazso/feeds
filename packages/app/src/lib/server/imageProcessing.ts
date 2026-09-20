import { encode } from 'blurhash'
import { createHash } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { cacheDir } from '../paths'

const BLURHASH_WIDTH = 32
const BLURHASH_HEIGHT = 32
const BLURHASH_COMPONENTS_X = 4
const BLURHASH_COMPONENTS_Y = 3

export interface ImageProcessingResult {
  blurhash: string
  aspectRatio: number
  cacheHash?: string // undefined if caching failed
  cacheExt?: string // "gif", "png", or "webp"
}

/**
 * Process an image: generate blurhash, calculate aspect ratio, and cache as WebP.
 * Returns undefined if processing fails entirely (e.g., network error, invalid image).
 * Individual operations (blurhash, caching) may fail independently.
 */
export async function processImage(
  imageUrl: string,
  user?: string,
): Promise<ImageProcessingResult | undefined> {
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

    // Cache the image - preserve animated images, convert others to WebP
    let cacheHash: string | undefined
    let cacheExt: string | undefined
    try {
      const isAnimated =
        (metadata.pages ?? 1) > 1 && (metadata.format === 'gif' || metadata.format === 'png')
      if (isAnimated) {
        const result = await cacheAnimatedImage(imageBuffer, metadata.format!, user)
        cacheHash = result?.hash
        cacheExt = result?.ext
      } else {
        cacheHash = await cacheImageAsWebP(imageBuffer, user)
        cacheExt = cacheHash ? 'webp' : undefined
      }
    } catch (e) {
      console.warn('Image caching failed:', e)
      // Continue without cache - blurhash is still useful
    }

    return {
      blurhash,
      aspectRatio,
      cacheHash,
      cacheExt,
    }
  } catch {
    return undefined
  }
}

/**
 * Convert image to WebP, calculate SHA256 hash, and save to cache folder.
 * Returns the hash on success, undefined on failure.
 */
async function cacheImageAsWebP(imageBuffer: Buffer, user?: string): Promise<string | undefined> {
  // Resize to max 560px width (preserve aspect ratio, don't upscale) and convert to WebP
  const webpBuffer = await sharp(imageBuffer)
    .resize({ width: 560, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  // Calculate SHA256 hash
  const hash = createHash('sha256').update(webpBuffer).digest('hex')

  // Create cache folder structure: /cache/[hex[0]]/[hex[1]]/
  const dir = join(cacheDir(user), hash[0], hash[1])
  await mkdir(dir, { recursive: true })

  // Save the WebP file
  const cachePath = join(dir, `${hash}.webp`)
  await writeFile(cachePath, webpBuffer)

  return hash
}

/**
 * Resize an animated image (GIF or APNG) while preserving animation, and save to cache.
 * Returns the hash and extension on success, undefined on failure.
 */
async function cacheAnimatedImage(
  imageBuffer: Buffer,
  format: string,
  user?: string,
): Promise<{ hash: string; ext: string } | undefined> {
  // Determine extension from format
  const ext = format === 'gif' ? 'gif' : 'png'

  // Resize while preserving animation
  const resizedBuffer = await sharp(imageBuffer, { animated: true })
    .resize({ width: 560, withoutEnlargement: true })
    .toBuffer()

  // Calculate SHA256 hash
  const hash = createHash('sha256').update(resizedBuffer).digest('hex')

  // Create cache folder structure: /cache/[hex[0]]/[hex[1]]/
  const dir = join(cacheDir(user), hash[0], hash[1])
  await mkdir(dir, { recursive: true })

  // Save with original extension
  const cachePath = join(dir, `${hash}.${ext}`)
  await writeFile(cachePath, resizedBuffer)

  return { hash, ext }
}

/**
 * Delete a cached image by its hash and extension.
 * Logs a warning if deletion fails (file may not exist).
 */
export async function deleteCachedImage(
  cacheHash: string,
  cacheExt = 'webp',
  user?: string,
): Promise<void> {
  const cachePath = join(cacheDir(user), cacheHash[0], cacheHash[1], `${cacheHash}.${cacheExt}`)
  try {
    await unlink(cachePath)
  } catch (e) {
    console.warn('Cache file deletion failed:', e)
  }
}

export interface FaviconProcessingResult {
  cacheHash: string
}

/**
 * Process a favicon: resize to 64x64 and cache as WebP.
 * Returns undefined if processing fails.
 */
export async function processFavicon(
  faviconUrl: string,
  user?: string,
): Promise<FaviconProcessingResult | undefined> {
  try {
    const response = await fetch(faviconUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/2.0)',
      },
    })

    if (!response.ok) {
      return undefined
    }

    const buffer = await response.arrayBuffer()
    const imageBuffer = Buffer.from(buffer)

    // Resize to 64x64 and convert to WebP
    const webpBuffer = await sharp(imageBuffer)
      .resize(64, 64, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer()

    // Calculate SHA256 hash
    const hash = createHash('sha256').update(webpBuffer).digest('hex')

    // Create cache folder structure: /cache/[hex[0]]/[hex[1]]/
    const dir = join(cacheDir(user), hash[0], hash[1])
    await mkdir(dir, { recursive: true })

    // Save the WebP file
    const cachePath = join(dir, `${hash}.webp`)
    await writeFile(cachePath, webpBuffer)

    return { cacheHash: hash }
  } catch (e) {
    console.warn('Favicon processing failed:', e)
    return undefined
  }
}

// Re-export generateBlurhash for backward compatibility
export { processImage as generateBlurhash }
