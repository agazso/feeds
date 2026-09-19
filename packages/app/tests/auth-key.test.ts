import { describe, expect, test } from 'vitest'
import { generateKey } from '../src/lib/server/auth'

// Keys are bearer tokens in a shareable URL: they must stay URL-safe and hard to guess.
// This guards the entropy against a future "let's make the link even shorter".
describe('generateKey', () => {
  test('is 22 URL-safe characters (128 bits, base64url)', () => {
    const key = generateKey()
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(encodeURIComponent(key)).toBe(key)
  })

  test('does not repeat', () => {
    const keys = new Set(Array.from({ length: 500 }, generateKey))
    expect(keys.size).toBe(500)
  })
})
