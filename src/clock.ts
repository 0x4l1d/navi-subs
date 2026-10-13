export interface Clock {
  left: () => number
  run: <T>(work: Promise<T>) => Promise<T>
}

// slow is not broken: nobody gets an error toast for it
export class SlowError extends Error {
  constructor (who = 'mirai') {
    super(`${who} took too long to answer`)
    this.name = 'SlowError'
  }
}

// for when there's nothing to wait for
export const noClock: Clock = { left: () => Infinity, run: work => work }

// work stops waiting when the time is up. the caller answers with what it has
export function startClock (ms: number, who = 'mirai'): Clock {
  const end = Date.now() + ms

  return {
    left: () => end - Date.now(),
    run (work) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new SlowError(who)), Math.max(0, end - Date.now()))
        work.then(resolve, reject).finally(() => clearTimeout(timer))
      })
    }
  }
}
