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

  /* Fallback using column-count for browsers without masonry */
  @supports not (grid-template-rows: masonry) {
    .three-column {
      display: block;
      column-count: 3;
      column-gap: var(--padding);
    }

    .three-column li {
      break-inside: avoid;
    }
  }

  @media (max-width: 900px) {
    @supports not (grid-template-rows: masonry) {
      .three-column {
        column-count: 2;
      }
    }
  }

  @media (max-width: 500px) {
    .three-column {
      display: grid;
      grid-template-columns: 1fr;
      column-count: unset;
    }

    .one-column {
      max-width: none;
    }
  }
</style>
