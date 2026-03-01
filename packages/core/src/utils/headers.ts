import { REDDIT_COM, TWITTER_COM, X_COM, getHumanHostname } from './url'

/** Safari user agent - works for most sites including Tumblr */
export const HEADERS_WITH_SAFARI = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Safari/605.1.15',
  Accept: '*/*',
}

/** Reddit API user agent */
export const HEADERS_WITH_FELFELE = {
  'User-Agent': 'org.felfele.feeds:1.0.0',
  Accept: '*/*',
}

/** curl user agent */
export const HEADERS_WITH_CURL = {
  'user-agent': 'curl/7.81.0',
  accept: '*/*',
}

/** WhatsApp user agent */
export const HEADERS_WITH_WHATSAPP = {
  'User-Agent': 'WhatsApp/2',
}

/** Discord bot user agent */
export const HEADERS_WITH_BOT = {
  'User-Agent': 'Discordbot/2.0',
  Accept: '*/*',
}

export function getHeadersForUrl(url: string): Record<string, string> {
  const hostname = getHumanHostname(url)

  if (hostname === REDDIT_COM) {
    return HEADERS_WITH_FELFELE
  }
  if (hostname === TWITTER_COM || hostname === X_COM) {
    return HEADERS_WITH_BOT
  }
  // Default - Safari works for most sites including Tumblr
  return HEADERS_WITH_SAFARI
}
