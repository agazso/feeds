import type { BrandedType } from '../types'

export type BundledImage = BrandedType<number, 'BundledImage'>

export interface ImageData {
  uri?: string
  width?: number
  height?: number
  blurhash?: string
  aspectRatio?: number // width / height
  data?: string
  localPath?: string | BundledImage
}
