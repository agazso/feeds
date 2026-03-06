<script lang="ts">
import type { Post } from '@feeds/core'
import PostCard from './PostCard.svelte'
import { preferences } from '$lib/stores/preferences.svelte'

interface Props {
  posts: Post[]
  onfilter?: (term: string) => void
  onremove?: (postId: string) => void
}

let { posts, onfilter, onremove }: Props = $props()

const layoutClass = $derived(preferences.layout)
</script>

<ul class="post-list {layoutClass}">
  {#each posts as post, index (post._id + '-' + index)}
    <li>
      <PostCard {post} {onfilter} {onremove} />
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

  @media (max-width: 500px) {
    .three-column {
      grid-template-columns: 1fr;
    }

    .one-column {
      max-width: none;
    }
  }
</style>
