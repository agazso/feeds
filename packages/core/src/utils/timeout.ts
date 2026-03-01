function clearTimeoutIfSet(t: ReturnType<typeof setTimeout> | undefined) {
  if (t != null) {
    clearTimeout(t)
  }
}

export async function timeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t =
      ms > 0
        ? setTimeout(() => {
            reject(new Error('timeout'))
          }, ms)
        : undefined

    promise.then(
      (value) => {
        clearTimeoutIfSet(t)
        resolve(value)
      },
      (reason) => {
        clearTimeoutIfSet(t)
        reject(reason)
      },
    )
  })
}

export async function waitMillisec(ms: number): Promise<number> {
  return new Promise<number>((resolve) => {
    if (ms > 0) {
      setTimeout(() => resolve(ms), ms)
    }
  })
}

export function isNodeJS(): boolean {
  return (
    typeof process === 'object' &&
    typeof process.versions === 'object' &&
    typeof process.versions.node !== 'undefined'
  )
}
