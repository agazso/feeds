/** Statuses that mean "ask again later" rather than "this will never work". */
const RATE_LIMIT_STATUSES = new Set([429, 503])

/**
 * A host asked us to slow down. Worth its own type because the page it serves parses
 * as perfectly good HTML with no feed in it — indistinguishable, without the status,
 * from a page that genuinely has no feed, which is a very different thing to tell
 * someone. YouTube in particular answers a 429 with a captcha page.
 */
export class RateLimitError extends Error {
  readonly status: number
  readonly host: string

  constructor(url: string, status: number) {
    const host = hostOf(url)
    super(
      `${host} is rate limiting requests right now (HTTP ${status}). Wait a few minutes and try again.`,
    )
    this.name = 'RateLimitError'
    this.status = status
    this.host = host
  }
}

export function isRateLimitStatus(status: number): boolean {
  return RATE_LIMIT_STATUSES.has(status)
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'The site'
  }
}
