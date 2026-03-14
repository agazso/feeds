import { encode } from 'blurhash'
import sharp from 'sharp'

const BLURHASH_WIDTH = 32
const BLURHASH_HEIGHT = 32
const BLURHASH_COMPONENTS_X = 4
const BLURHASH_COMPONENTS_Y = 3

interface BlurhashResult {
  blurhash: string
  aspectRatio: number
}

/**
 * Generate a blurhash from an image URL.
 * Returns undefined if generation fails (e.g., network error, invalid image).
 */
export async function generateBlurhash(imageUrl: string): Promise<BlurhashResult | undefined> {
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
    const sharpImage = sharp(Buffer.from(buffer))

    // Get original dimensions BEFORE resizing
    const metadata = await sharpImage.metadata()
    if (!metadata.width || !metadata.height) {
      return undefined
    }

    // Resize to small size and get raw pixel data
    const { data, info } = await sharpImage
      .resize(BLURHASH_WIDTH, BLURHASH_HEIGHT, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Encode to blurhash
    const blurhash = encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      BLURHASH_COMPONENTS_X,
      BLURHASH_COMPONENTS_Y,
    )

    return {
      blurhash,
      aspectRatio: metadata.width / metadata.height,
    }
  } catch {
    return undefined
  }
}
