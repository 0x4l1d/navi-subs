import type { Store } from './store.ts'

const DAY = 24 * 60 * 60 * 1000

export interface Limit {
  perMinute: number
  perDay: number
}

export interface Limiter {
  // true when one more request fits, and counts it
  take: () => Promise<boolean>
  // how many went out today
  used: () => Promise<number>
}

const today = () => new Date().toISOString().slice(0, 10)

// keeps a source under its site's limits. the day's count is kept, so a restart doesn't reset it
export function limiter (store: Store, id: string, limit: Limit): Limiter {
  const recent: number[] = []
  let day = ''
  let count: number | undefined

  async function load () {
    if (count === undefined || day !== today()) {
      day = today()
      count = (await store.get<number>(`quota:${id}:${day}`))?.value ?? 0
    }
    return count
  }

  return {
    async take () {
      const now = Date.now()
      while (recent.length && recent[0]! < now - 60_000) recent.shift()
      if (recent.length >= limit.perMinute) return false
      if (await load() >= limit.perDay) return false

      recent.push(now)
      count = (count ?? 0) + 1
      store.set(`quota:${id}:${day}`, count, 2 * DAY)
      return true
    },
    used: load
  }
}
