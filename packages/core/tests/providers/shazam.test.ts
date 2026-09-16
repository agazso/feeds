import { describe, expect, it } from 'vitest'
import { parseShazamSongId } from '../../src/providers/shazam'

describe('parseShazamSongId', () => {
  it('extracts the track id from a song URL', () => {
    expect(parseShazamSongId('https://www.shazam.com/song/1727145711/mahal')).toBe('1727145711')
  })

  it('handles the localized path prefix', () => {
    expect(parseShazamSongId('https://www.shazam.com/de-de/song/1727145711/mahal')).toBe(
      '1727145711',
    )
  })

  it('ignores other shazam pages and other hosts', () => {
    expect(parseShazamSongId('https://www.shazam.com/artist/123/glass-beams')).toBeUndefined()
    expect(parseShazamSongId('https://notshazam.com/song/1727145711/mahal')).toBeUndefined()
    expect(parseShazamSongId('not a url')).toBeUndefined()
  })
})
