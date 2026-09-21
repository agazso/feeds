import { describe, expect, test } from 'vitest'
import {
  compareUrls,
  createUrlFromUrn,
  getBaseUrl,
  getCanonicalUrl,
  getHumanHostname,
  getLinkFromText,
  isYoutubeUrl,
  normalizeUrl,
} from '../../src/utils/url'

test('Test invalid human hostname', () => {
  const input = ''
  const expectedResult = ''
  const result = getHumanHostname(input)

  expect(result).toBe(expectedResult)
})

test('Test human hostname', () => {
  const input = 'https://reddit.com/r/android'
  const expectedResult = 'reddit.com'
  const result = getHumanHostname(input)

  expect(result).toBe(expectedResult)
})

test('Test human hostname with long name', () => {
  const input = 'https://www.gfdl.noaa.gov/global-warming-and-hurricanes/'
  const expectedResult = 'noaa.gov'
  const result = getHumanHostname(input)

  expect(result).toBe(expectedResult)
})

test('Test human hostname with numeric address', () => {
  const input = 'http://192.168.1.49:2368/untitled-15/'
  const expectedResult = '1.49'
  const result = getHumanHostname(input)

  expect(result).toBe(expectedResult)
})

test('Test base url', () => {
  const input = 'https://www.gfdl.noaa.gov/global-warming-and-hurricanes/'
  const expectedResult = 'https://www.gfdl.noaa.gov/'
  const result = getBaseUrl(input)

  expect(result).toBe(expectedResult)
})

test('Test base url without protocol', () => {
  const input = '//www.gfdl.noaa.gov/global-warming-and-hurricanes/'
  const expectedResult = 'https://www.gfdl.noaa.gov/'
  const result = getBaseUrl(input)

  expect(result).toBe(expectedResult)
})

test('Test url creation from urn', () => {
  const baseUrl = 'https://www.gfdl.noaa.gov/'
  const urn = '/global-warming-and-hurricanes/'
  const expectedResult = 'https://www.gfdl.noaa.gov/global-warming-and-hurricanes/'
  const result = createUrlFromUrn(urn, baseUrl)

  expect(result).toBe(expectedResult)
})

test('Test url creation from urn without trailing slash', () => {
  const baseUrl = 'https://www.gfdl.noaa.gov/'
  const urn = 'global-warming-and-hurricanes/'
  const expectedResult = 'https://www.gfdl.noaa.gov/global-warming-and-hurricanes/'
  const result = createUrlFromUrn(urn, baseUrl)

  expect(result).toBe(expectedResult)
})

test('Test url creation from urn without ending and trailing slash', () => {
  const baseUrl = 'https://www.gfdl.noaa.gov'
  const urn = 'global-warming-and-hurricanes/'
  const expectedResult = 'https://www.gfdl.noaa.gov/global-warming-and-hurricanes/'
  const result = createUrlFromUrn(urn, baseUrl)

  expect(result).toBe(expectedResult)
})

test('Test canonical url', () => {
  const inputs = [
    'example.com',
    '//example.com',
    'https://example.com',
    'https://example.com/',
    'https://example.com?abc=bcd',
  ]
  const expectedResult = 'https://example.com/'

  for (const input of inputs) {
    const result = getCanonicalUrl(input)
    expect(result).toBe(expectedResult)
  }
})

test('Test canonical url with path', () => {
  const inputs = [
    'example.com/1',
    '//example.com/1',
    'https://example.com/1',
    'https://example.com/1?abc=bcd',
  ]
  const expectedResult = 'https://example.com/1'

  for (const input of inputs) {
    const result = getCanonicalUrl(input)
    expect(result).toBe(expectedResult)
  }
})

test('Test canonical with empty url', () => {
  const input = ''
  const expectedResult = ''

  const result = getCanonicalUrl(input)
  expect(result).toBe(expectedResult)
})

test('Test getLinkFromText with https link without trailing slash', () => {
  const link = 'https://swarm-gateways.net'
  const input = `Lorem ipsum ${link}`
  const result = getLinkFromText(input)

  expect(result).toBe(link)
})

test('Test getLinkFromText with https link', () => {
  const link = 'https://swarm-gateways.net/'
  const input = `Lorem ipsum ${link}`
  const result = getLinkFromText(input)

  expect(result).toBe(link)
})

test('Test getLinkFromText with https link in a sentence', () => {
  const link = 'https://swarm-gateways.net/'
  const input = `Lorem ipsum ${link} dolor sit amet`
  const result = getLinkFromText(input)

  expect(result).toBe(link)
})

describe('comparing URLs', () => {
  const inputs = [
    'example.com',
    'www.example.com',
    'https://example.com/',
    'http://example.com/',
    'http://example.com',
    'https://www.example.com/',
  ]

  test('basic comparison', () => {
    const link = 'example.com'
    for (const input of inputs) {
      const result = compareUrls(input, link)
      expect(result).toBeTruthy()
    }
  })

  test('basic comparison with protocol and www', () => {
    const link = 'https://www.example.com/'
    for (const input of inputs) {
      const result = compareUrls(input, link)
      expect(result).toBeTruthy()
    }
  })
})

describe('normalizeUrl', () => {
  test('adds https:// to bare domains', () => {
    expect(normalizeUrl('reddit.com/r/linux')).toBe('https://reddit.com/r/linux')
    expect(normalizeUrl('example.com')).toBe('https://example.com/')
  })

  test('preserves existing protocols', () => {
    expect(normalizeUrl('https://reddit.com/r/linux')).toBe('https://reddit.com/r/linux')
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/')
  })

  test('handles protocol-relative URLs', () => {
    expect(normalizeUrl('//reddit.com/r/linux')).toBe('https://reddit.com/r/linux')
  })

  test('returns null for invalid input', () => {
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
  })

  test('trims whitespace', () => {
    expect(normalizeUrl('  reddit.com/r/linux  ')).toBe('https://reddit.com/r/linux')
  })
})

describe('isYoutubeUrl', () => {
  test('matches youtube hosts', () => {
    expect(isYoutubeUrl('https://www.youtube.com/watch?v=x')).toBe(true)
    expect(isYoutubeUrl('https://m.youtube.com/watch?v=x')).toBe(true)
    expect(isYoutubeUrl('https://www.youtube.com/feeds/videos.xml?channel_id=UC1')).toBe(true)
  })

  // The share link YouTube's own app hands out. Without this it falls through to
  // generic discovery, which finds nothing on a video page.
  test('matches the youtu.be share link', () => {
    expect(isYoutubeUrl('https://youtu.be/cT2-7KkPkBc')).toBe(true)
  })

  test('rejects non-youtube hosts (incl. the endsWith trap)', () => {
    expect(isYoutubeUrl('https://notyoutube.com/watch?v=x')).toBe(false)
    expect(isYoutubeUrl('https://example.com')).toBe(false)
  })
})
