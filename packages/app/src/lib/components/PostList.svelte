<script lang="ts">
import type { Post } from '@feeds/core'
import type Colcade from 'colcade'
import { browser } from '$app/environment'
import PostCard from './PostCard.svelte'
import { preferences } from '$lib/stores/preferences.svelte'
import { supportsCSSMasonry } from '$lib/utils/masonry'

interface Props {
  posts: Post[]
  onfilter?: (term: string) => void
  onremove?: (postId: string) => void
  feedUrlToPageUrl?: Record<string, string>
}

let { posts, onfilter, onremove, feedUrlToPageUrl }: Props = $props()

let listElement: HTMLUListElement | undefined = $state()
let colcadeInstance: Colcade | undefined = $state()
let colcadeReady = $state(true)

const layoutClass = $derived(preferences.layout)
const needsJSMasonry = $derived(
  browser && layoutClass === 'three-column' && !supportsCSSMasonry()
)

// Initialize/destroy Colcade when needed
$effect(() => {
  if (needsJSMasonry && listElement) {
    // Re-add hiding class for SPA navigation (inline script handles initial load)
    document.documentElement.classList.add('js-masonry-loading')

    const element = listElement
    import('colcade').then((module) => {
      const Colcade = module.default
      colcadeInstance = new Colcade(element, {
        columns: '.masonry-col',
        items: '.post-item'
      })
      colcadeReady = true
      // Remove the early-hiding class now that Colcade is ready
      document.documentElement.classList.remove('js-masonry-loading')
    })
  }

  return () => {
    if (colcadeInstance) {
      colcadeInstance.destroy()
      colcadeInstance = undefined
    }
  }
})

// Re-layout when posts change
$effect(() => {
  if (colcadeInstance && posts) {
    // Trigger re-layout after DOM updates
    requestAnimationFrame(() => {
      colcadeInstance?.layout()
    })
  }
})

// Resize handler with debounce
$effect(() => {
  if (!browser || !colcadeInstance) return

  let resizeTimeout: ReturnType<typeof setTimeout>

  const handleResize = () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      colcadeInstance?.layout()
    }, 100)
  }

  window.addEventListener('resize', handleResize)

  return () => {
    clearTimeout(resizeTimeout)
    window.removeEventListener('resize', handleResize)
  }
})
</script>

<ul bind:this={listElement} class="post-list {layoutClass}" class:js-masonry={needsJSMasonry}>
  {#if needsJSMasonry}
    <li class="masonry-col"></li>
    <li class="masonry-col"></li>
    <li class="masonry-col"></li>
  {/if}
  {#each posts as post, index (post._id + '-' + index)}
    <li class="post-item">
      <PostCard {post} {onfilter} {onremove} {feedUrlToPageUrl} />
    </li>
  {/each}
</ul>

<style>
  .post-list {
    display: grid;
    gap: var(--padding);
    padding: 0;
    margin: 0;
    margin-bottom: 1em;
    justify-content: center;
    list-style-type: none;
  }

  .post-list li {
    display: flex;
    flex-direction: column;
  }

  .three-column {
    grid-template-columns: var(--column-mode);
  }

  .one-column {
    grid-template-columns: var(--column-mode);
    max-width: var(--max-column-width);
    margin-left: auto;
    margin-right: auto;
  }

  /* CSS Grid masonry support (Firefox) */
  @supports (grid-template-rows: masonry) {
    .three-column {
      grid-template-rows: masonry;
    }
  }

  /* CSS Grid Level 3 grid-lanes support (experimental) */
  @supports (display: grid-lanes) {
    .three-column {
      display: grid-lanes;
      grid-template-columns: var(--column-mode);
    }
  }

  /* Fallback using simple grid for browsers without masonry */
  @supports not (grid-template-rows: masonry) {
    .three-column {
      align-items: start;
    }
  }

  /* JS Masonry fallback (Colcade) */
  .js-masonry {
    display: block !important;
  }

  .js-masonry .masonry-col {
    float: left;
    width: calc(33.333% - var(--padding) * 2 / 3);
    margin-right: var(--padding);
  }

  .js-masonry .masonry-col:last-of-type {
    margin-right: 0;
  }

  .js-masonry .post-item {
    margin-bottom: var(--padding);
  }

  .js-masonry::after {
    content: '';
    display: block;
    clear: both;
  }

  @media (max-width: 500px) {
    .three-column {
      grid-template-columns: 1fr;
    }

    .one-column {
      max-width: none;
    }

    .post-list {
      padding-bottom: calc(var(--padding) * 8);
    }

    .js-masonry .masonry-col {
      width: 100%;
      margin-right: 0;
    }
  }
</style>
