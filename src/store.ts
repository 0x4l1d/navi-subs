// things worth keeping across restarts: which page a show has, what a page lists, the subtitles themselves.
// the browser's Cache Storage when there is one, memory when not

export interface Store {
  get: <V>(key: string) => Promise<{ value: V, at: number } | undefined>
  set: (key: string, value: unknown, life: number) => Promise<void>
}

interface Kept {
  value: unknown
  at: number
  until: number
}

export function memoryStore (max = 400): Store {
  const map = new Map<string, Kept>()
  return {
    async get<V> (key: string) {
      const hit = map.get(key)
      if (!hit) return undefined
      if (hit.until < Date.now()) {
        map.delete(key)
        return undefined
      }
      return { value: hit.value as V, at: hit.at }
    },
    async set (key, value, life) {
      map.delete(key)
      map.set(key, { value, at: Date.now(), until: Date.now() + life })
      if (map.size > max) map.delete(map.keys().next().value!)
    }
  }
}

// one cache entry per key, the body is json. old entries are dropped when read
export function cacheStore (name: string, fallback: Store = memoryStore()): Store {
  let opening: Promise<Cache | undefined> | undefined
  const open = () => (opening ??= (async () => {
    try {
      return typeof caches === 'undefined' ? undefined : await caches.open(name)
    } catch {
      // private windows and some webviews refuse
      return undefined
    }
  })())
  const url = (key: string) => `https://navi-subs.invalid/${encodeURIComponent(key)}`

  return {
    async get<V> (key: string) {
      const cache = await open()
      if (!cache) return await fallback.get<V>(key)
      try {
        const res = await cache.match(url(key))
        if (!res) return undefined
        const kept = await res.json() as Kept
        if (kept.until < Date.now()) {
          cache.delete(url(key))
          return undefined
        }
        return { value: kept.value as V, at: kept.at }
      } catch {
        return undefined
      }
    },
    async set (key, value, life) {
      const cache = await open()
      if (!cache) return await fallback.set(key, value, life)
      try {
        const kept: Kept = { value, at: Date.now(), until: Date.now() + life }
        await cache.put(url(key), new Response(JSON.stringify(kept), { headers: { 'content-type': 'application/json' } }))
      } catch {
        // full or blocked, it still works without
      }
    }
  }
}

// the store when it works, memory when it doesn't
export function defaultStore (): Store {
  return cacheStore('navi-subs-v1')
}
