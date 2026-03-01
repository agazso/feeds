import { timeout } from './timeout'

export async function safeFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(
      'Network error: ' +
        response.status +
        ', text: ' +
        response.statusText +
        ', request: ' +
        input.toString(),
    )
  }
  return response
}

export async function safeFetchWithTimeout(
  input: string | URL,
  init?: RequestInit,
  timeoutMillis = 0,
): Promise<Response> {
  return await timeout(timeoutMillis, safeFetch(input, init))
}

export async function safeFetchWithFollow(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  let response = await fetch(input, { ...init, redirect: 'manual' })
  let numTries = 0
  const maxTries = 10
  const isFoundRedirected = (resp: Response) => resp.status >= 300 && resp.status < 400
  const isRedirected = (resp: Response) => resp.redirected || isFoundRedirected(resp)
  while (isRedirected(response) && numTries < maxTries) {
    const redirectedUrl = isFoundRedirected(response)
      ? (response.headers.get('location') ?? '')
      : response.url

    response = await fetch(redirectedUrl, { ...init, redirect: 'manual' })
    numTries += 1
  }
  return response
}
