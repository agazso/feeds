import {
  type HtmlMetaData,
  type OpenGraphData,
  fetchHtmlMetaDataOnly,
  fetchOpenGraphData,
} from '@feeds/core'

export async function getOpenGraphData(url: string): Promise<OpenGraphData> {
  return fetchOpenGraphData(url)
}

export async function getHtmlMetadata(url: string): Promise<HtmlMetaData> {
  return fetchHtmlMetaDataOnly(url)
}
