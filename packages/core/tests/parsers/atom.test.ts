import { describe, expect, test } from 'vitest'
import { parseAtomFeed } from '../../src/parsers/atom'

function makeJson(entry: Record<string, unknown>) {
  return {
    feed: {
      entry: [
        {
          title: ['A title'],
          link: [{ rel: 'alternate', href: 'https://example.com/1', type: 'text/html' }],
          updated: ['2026-01-01T00:00:00Z'],
          ...entry,
        },
      ],
    },
  }
}

describe('parseAtomFeed image extraction', () => {
  // Reddit embeds the post image in the entry <content> HTML (no media:thumbnail).
  test('extracts a Reddit content image into media, decoding entities', () => {
    const json = makeJson({
      content: [
        {
          _text: '<a href="x"><img src="https://preview.redd.it/x.jpg?width=640&amp;s=sig"/></a>',
          type: 'html',
        },
      ],
    })
    const feed = parseAtomFeed(json)
    expect(feed.items[0]?.media?.thumbnail?.[0]?.url?.[0]).toBe(
      'https://preview.redd.it/x.jpg?width=640&s=sig',
    )
  })

  test('prefers a media:group thumbnail over the content image', () => {
    const json = makeJson({
      content: [{ _text: '<img src="https://preview.redd.it/x.jpg"/>', type: 'html' }],
      'media:group': [
        {
          'media:thumbnail': [
            { url: 'https://i.ytimg.com/thumb.jpg', width: '480', height: '360' },
          ],
        },
      ],
    })
    const feed = parseAtomFeed(json)
    expect(feed.items[0]?.media?.thumbnail?.[0]?.url?.[0]).toBe('https://i.ytimg.com/thumb.jpg')
  })

  test('ignores non-Reddit content images (scoped out)', () => {
    const json = makeJson({
      content: [{ _text: '<img src="https://example.com/a.png"/>', type: 'html' }],
    })
    const feed = parseAtomFeed(json)
    expect(feed.items[0]?.media).toBeUndefined()
  })

  test('content with no image yields no media', () => {
    const json = makeJson({ content: [{ _text: '<p>hello</p>', type: 'html' }] })
    const feed = parseAtomFeed(json)
    expect(feed.items[0]?.media).toBeUndefined()
  })
})

// The XML parser is configured with textNodeName '_text'; a `<title type='text'>`
// (Blogger) parses to an object, so reading only `_` lost the name → "Unknown Feed".
describe('parseAtomFeed titles', () => {
  test('reads titles carrying attributes', () => {
    const feed = parseAtomFeed({
      feed: {
        title: [{ _text: 'Indie Retro News', type: 'text' }],
        entry: [{ title: [{ _text: 'A post', type: 'text' }], summary: [{ _text: 'Body' }] }],
      },
    })
    expect(feed.title).toBe('Indie Retro News')
    expect(feed.items[0]?.title).toBe('A post')
    expect(feed.items[0]?.description).toBe('Body')
  })

  test('still reads plain string and `_` titles', () => {
    const feed = parseAtomFeed({
      feed: { title: ['Plain'], entry: [{ title: [{ _: 'Legacy' }] }] },
    })
    expect(feed.title).toBe('Plain')
    expect(feed.items[0]?.title).toBe('Legacy')
  })
})
