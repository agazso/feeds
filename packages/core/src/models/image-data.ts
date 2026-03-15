import type { BrandedType } from '../types'

export type BundledImage = BrandedType<number, 'BundledImage'>

export interface ImageData {
  uri?: string
  width?: number
  height?: number
  blurhash?: string
  aspectRatio?: number // width / height
  cacheHash?: string // SHA256 hash of cached image (WebP)
  data?: string
  localPath?: string | BundledImage
}
