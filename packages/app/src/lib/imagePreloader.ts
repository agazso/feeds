const preloadedImages = new Set<string>()
const preloadQueue: string[] = []
let isPreloading = false

export function preloadImage(src: string): void {
  if (preloadedImages.has(src) || preloadQueue.includes(src)) return
  preloadQueue.push(src)
  processQueue()
}

function processQueue(): void {
  if (isPreloading || preloadQueue.length === 0) return
  isPreloading = true
  const src = preloadQueue.shift()
  if (src === undefined) {
    isPreloading = false
    return
  }
  const img = new Image()
  img.onload = img.onerror = () => {
    preloadedImages.add(src)
    isPreloading = false
    processQueue()
  }
  img.src = src
}

export function isPreloaded(src: string): boolean {
  return preloadedImages.has(src)
}
