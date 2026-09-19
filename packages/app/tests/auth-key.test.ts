import { describe, expect, test } from 'vitest'
import { generateKey } from '../src/lib/server/auth'

// Keys are bearer tokens in a shareable URL: they must stay URL-safe and hard to guess.
// This guards the entropy against a future "let's make the link even shorter".
describe('generateKey', () => {
  test('is 23 base58 characters (~135 bits)', () => {
    const key = generateKey()
    expect(key).toMatch(/^[1-9A-HJ-NP-Za-km-z]{23}$/)
    expect(encodeURIComponent(key)).toBe(key)
  })

  test('avoids characters that are ambiguous or break selection', () => {
    const keys = Array.from({ length: 200 }, generateKey).join('')
    expect(keys).not.toMatch(/[0OIl+/\-_=]/)
  })

  test('does not repeat', () => {
    const keys = new Set(Array.from({ length: 500 }, generateKey))
    expect(keys.size).toBe(500)
  })

  test('uses the whole alphabet — no modulo bias toward the low letters', () => {
    const counts = new Map<string, number>()
    for (const c of Array.from({ length: 2000 }, generateKey).join('')) {
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    expect(counts.size).toBe(58)
    // Uniform expectation is 2000*23/58 ≈ 793; a doubled rate for the first 24 symbols
    // (the classic `% 58` bias) would land far outside this band.
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(600)
      expect(n).toBeLessThan(1000)
    }
  })
})
