import { describe, expect, test } from 'vitest'
import { isValidUserName, stripUser, userFromPath, userPrefix } from '../src/lib/user'

describe('userFromPath', () => {
  test('reads the user off a /@name path', () => {
    expect(userFromPath('/@bob/myfeed')).toBe('bob')
    expect(userFromPath('/@bob')).toBe('bob')
    expect(userFromPath('/@b_o_b1/feeds/https%3A%2F%2Fx.com')).toBe('b_o_b1')
  })

  test('lowercases the name — the url may capitalize, the filesystem never does', () => {
    expect(userFromPath('/@Bob/myfeed')).toBe('bob')
    expect(userFromPath('/@BOB')).toBe('bob')
  })

  test('undefined in single-user mode', () => {
    expect(userFromPath('/')).toBeUndefined()
    expect(userFromPath('/myfeed')).toBeUndefined()
    expect(userFromPath('/share/https%3A%2F%2Fx.com%2F%40bob')).toBeUndefined()
  })

  test('rejects anything outside [A-Za-z0-9_]', () => {
    expect(userFromPath('/@../../etc')).toBeUndefined()
    expect(userFromPath('/@.')).toBeUndefined()
    expect(userFromPath('/@bob.evil')).toBeUndefined()
    expect(userFromPath('/@bob-evil')).toBeUndefined()
    expect(userFromPath('/@bőb')).toBeUndefined()
    expect(userFromPath('/@')).toBeUndefined()
  })
})

describe('isValidUserName', () => {
  test('accepts only lowercase latin, digits and underscore', () => {
    expect(isValidUserName('bob_1')).toBe(true)
    expect(isValidUserName('Bob')).toBe(false)
    expect(isValidUserName('bob-1')).toBe(false)
    expect(isValidUserName('..')).toBe(false)
    expect(isValidUserName('a/b')).toBe(false)
    expect(isValidUserName('')).toBe(false)
  })

  test('accepts every name userFromPath produces', () => {
    for (const path of ['/@bob', '/@Bob/feeds', '/@B_2/tags/music']) {
      expect(isValidUserName(userFromPath(path)!)).toBe(true)
    }
  })
})

describe('stripUser / userPrefix', () => {
  test('a bare user path routes to the index', () => {
    expect(stripUser('/@bob')).toBe('/')
    expect(stripUser('/@bob/tags/music')).toBe('/tags/music')
    expect(stripUser('/tags/music')).toBe('/tags/music')
  })

  test('strips a capitalized prefix too, and canonicalizes links to lowercase', () => {
    expect(stripUser('/@Bob/tags/music')).toBe('/tags/music')
    expect(userPrefix('/@Bob/tags/music')).toBe('/@bob')
    expect(userPrefix('/tags/music')).toBe('')
  })
})
