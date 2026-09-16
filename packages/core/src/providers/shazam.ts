import { timeout } from '../utils/timeout'

/**
 * shazam.com serves 405 to every non-browser client (Varnish bot rule), so its pages
 * can't be scraped for og: tags. The song id in the URL is the Apple Music track id,
 * and the public iTunes lookup API serves the same metadata as JSON.
 */

export interface ShazamSongMetadata {
  title: string
  description: string
  image: string
  artist: string
}

/** https://www.shazam.com/song/<trackId>/<slug> (optionally /<lang>/song/...) */
export function parseShazamSongId(url: string): string | undefined {
  try {
    const { hostname, pathname } = new URL(url)
    if (!/(^|\.)shazam\.com$/.test(hostname)) return undefined
    return pathname.match(/\/song\/(\d+)/)?.[1]
  } catch {
    return undefined
  }
}

/**
 * A lookup is answered by one storefront at a time (US by default) and a track missing
 * from that store returns no results, so try a few before giving up.
 * ponytail: three cover what we've seen; add more if a song still comes back empty.
 */
const STOREFRONTS = ['US', 'HU', 'GB']

async function lookupTrack(id: string, country: string): Promise<Record<string, string> | null> {
  const res = await timeout(
    5000,
    fetch(`https://itunes.apple.com/lookup?id=${id}&country=${country}`),
  )
  if (!res.ok) return null
  const { results } = (await res.json()) as { results?: Record<string, string>[] }
  return results?.[0] ?? null
}

/** "/song/1889578568/bird" → "Bird" — a last resort, but it beats another song's title. */
function titleFromSlug(url: string): string {
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export async function fetchShazamSongMetadata(url: string): Promise<ShazamSongMetadata | null> {
  const id = parseShazamSongId(url)
  if (!id) return null

  for (const country of STOREFRONTS) {
    try {
      const track = await lookupTrack(id, country)
      if (track?.trackName) {
        return {
          title: track.trackName,
          description: [track.collectionName, track.releaseDate?.slice(0, 4)]
            .filter(Boolean)
            .join(' · '),
          // The API only returns a 100px thumbnail; the size is part of the path.
          image: track.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/600x600bb.') ?? '',
          artist: track.artistName ?? '',
        }
      }
    } catch {
      // network/timeout on this storefront — try the next
    }
  }

  // Never fall through to the HTML: shazam.com answers non-browser clients with some
  // other song's page, so a scrape here would produce a confidently wrong preview.
  return { title: titleFromSlug(url), description: '', image: '', artist: '' }
}
