<script lang="ts">
  import { decode } from 'blurhash'

  interface Props {
    src: string
    fallbackSrc?: string
    blurhash?: string
    aspectRatio?: number
    alt?: string
    class?: string
    onload?: (e: Event) => void
  }

  let { src, fallbackSrc, blurhash, aspectRatio, alt = '', class: className, onload }: Props = $props()
  let loaded = $state(false)
  let currentSrc = $state(src)
  let canvas: HTMLCanvasElement | undefined = $state()

  // Reset currentSrc when src prop changes
  $effect(() => {
    currentSrc = src
  })

  // Decode blurhash to canvas on mount
  $effect(() => {
    if (blurhash && canvas) {
      try {
        const pixels = decode(blurhash, 32, 32)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const imageData = ctx.createImageData(32, 32)
          imageData.data.set(pixels)
          ctx.putImageData(imageData, 0, 0)
        }
      } catch {
        // Invalid blurhash, ignore
      }
    }
  })

  function handleLoad(e: Event) {
    loaded = true
    onload?.(e)
  }

  function handleError() {
    // If cached image fails, try fallback (original URL)
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      currentSrc = fallbackSrc
    }
  }
</script>

<div class="blurhash-container {className || ''}" style:aspect-ratio={aspectRatio}>
  {#if blurhash && !loaded}
    <canvas bind:this={canvas} width="32" height="32" class="blurhash-placeholder"></canvas>
  {/if}
  <img src={currentSrc} {alt} class:loaded onload={handleLoad} onerror={handleError} />
</div>

<style>
  .blurhash-container {
    position: relative;
    overflow: hidden;
  }

  .blurhash-placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    filter: blur(20px);
    transform: scale(1.2);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  img.loaded {
    opacity: 1;
  }
</style>
