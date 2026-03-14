import { preloadImage } from '$lib/imagePreloader'

export function preloadOnScroll(node: HTMLElement, src: string | undefined) {
  if (!src) return

  let currentSrc = src

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && currentSrc) {
        preloadImage(currentSrc)
        observer.disconnect()
      }
    },
    { rootMargin: '500px' }, // Preload 500px before visible
  )
  observer.observe(node)

  return {
    update(newSrc: string | undefined) {
      if (newSrc && newSrc !== currentSrc) {
        currentSrc = newSrc
        preloadImage(newSrc)
      }
    },
    destroy() {
      observer.disconnect()
    },
  }
}
