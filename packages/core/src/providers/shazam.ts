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

export async function fetchShazamSongMetadata(url: string): Promise<ShazamSongMetadata | null> {
  const id = parseShazamSongId(url)
  if (!id) return null

  try {
    const res = await timeout(5000, fetch(`https://itunes.apple.com/lookup?id=${id}`))
    if (!res.ok) return null
    const { results } = (await res.json()) as { results?: Record<string, string>[] }
    const track = results?.[0]
    if (!track?.trackName) return null

    return {
      title: track.trackName,
      description: [track.collectionName, track.releaseDate?.slice(0, 4)]
        .filter(Boolean)
        .join(' · '),
      // The API only returns a 100px thumbnail; the size is part of the path.
      image: track.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/600x600bb.') ?? '',
      artist: track.artistName ?? '',
    }
  } catch {
    return null // lookup failed → caller falls back to generic HTML metadata
  }
}
