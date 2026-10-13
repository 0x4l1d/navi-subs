import type { Clock } from './clock.ts'

export const ORIGIN = 'https://miraianime.net'

export class HttpError extends Error {
  status: number

  // only the path goes in the message, a query string can carry a key
  constructor (status: number, url: string, who = 'mirai') {
    super(`${who} answered ${status} for ${new URL(url).pathname}`)
    this.name = 'HttpError'
    this.status = status
  }
}

// the site is there but wants a browser check first
export class BlockedError extends Error {
  constructor (who = 'mirai') {
    super(`${who} wants a cloudflare check, open the site once in a browser`)
    this.name = 'BlockedError'
  }
}

// the site can't be reached at all
export class DownError extends Error {
  constructor (who = 'mirai') {
    super(`${who} can't be reached`)
    this.name = 'DownError'
  }
}

// only ok comes back, anything else throws so nobody forgets to check
export async function request (fetchFn: typeof fetch, url: string, clock: Clock, headers?: Record<string, string>, who = 'mirai'): Promise<Response> {
  let res: Response
  try {
    res = await clock.run(fetchFn(url, headers ? { headers } : undefined))
  } catch (error) {
    // fetch throws a TypeError when the network or the site is gone, our own errors pass through
    if (error instanceof TypeError) throw new DownError(who)
    throw error
  }
  if (res.ok) return res

  // cloudflare's check page is a 403/503 with html, say so
  const body = res.status === 403 || res.status === 503 ? await clock.run(res.text()).catch(() => '') : ''
  if (/just a moment|challenge-platform|cf-chl/i.test(body)) throw new BlockedError(who)
  throw new HttpError(res.status, url, who)
}

export async function getText (fetchFn: typeof fetch, url: string, clock: Clock, headers?: Record<string, string>, who = 'mirai'): Promise<string> {
  const res = await request(fetchFn, url, clock, headers, who)
  return await clock.run(res.text())
}
