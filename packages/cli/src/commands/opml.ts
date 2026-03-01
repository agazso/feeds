import { type Feed, type OPMLFeed, convertOPMLFeed, readOPML, tryFetchOPML } from '@feeds/core'

export async function importOpmlFromUrl(url: string): Promise<Feed[] | undefined> {
  return tryFetchOPML(url)
}

export async function parseOpml(xml: string): Promise<OPMLFeed[]> {
  return readOPML(xml)
}

export async function convertOpmlFeed(opmlFeed: OPMLFeed): Promise<Feed | undefined> {
  return convertOPMLFeed(opmlFeed)
}
