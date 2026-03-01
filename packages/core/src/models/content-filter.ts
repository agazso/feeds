import { printableElapsedTime } from '../utils/date'
import type { Model } from './model'

export interface ContentFilter extends Model {
  text: string
  createdAt: number
  validUntil: number
}

export function filterValidUntilToText(validUntil: number): string {
  if (validUntil === 0) {
    return 'forever'
  }
  return printableElapsedTime(0, validUntil)
}
