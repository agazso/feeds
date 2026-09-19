import { describe, expect, test } from 'vitest'
import { stripUser, userFromPath, userPrefix } from '../src/lib/user'

describe('userFromPath', () => {
  test('reads the user off a /@name path', () => {
    expect(userFromPath('/@bob/myfeed')).toBe('bob')
    expect(userFromPath('/@bob')).toBe('bob')
    expect(userFromPath('/@b-o_b1/feeds/https%3A%2F%2Fx.com')).toBe('b-o_b1')
  })

  test('undefined in single-user mode', () => {
    expect(userFromPath('/')).toBeUndefined()
    expect(userFromPath('/myfeed')).toBeUndefined()
    expect(userFromPath('/share/https%3A%2F%2Fx.com%2F%40bob')).toBeUndefined()
  })

  test('rejects names that could escape the data dir', () => {
    expect(userFromPath('/@../../etc')).toBeUndefined()
    expect(userFromPath('/@.')).toBeUndefined()
    expect(userFromPath('/@bob.evil')).toBeUndefined()
    expect(userFromPath('/@')).toBeUndefined()
  })
})

describe('stripUser / userPrefix', () => {
  test('the prefix and the stripped path reassemble the original', () => {
    for (const path of ['/@bob/myfeed', '/@bob', '/myfeed', '/']) {
      expect(userPrefix(path) + stripUser(path)).toBe(path === '/@bob' ? '/@bob/' : path)
    }
  })

  test('a bare user path routes to the index', () => {
    expect(stripUser('/@bob')).toBe('/')
    expect(stripUser('/@bob/tags/music')).toBe('/tags/music')
    expect(stripUser('/tags/music')).toBe('/tags/music')
  })
})
