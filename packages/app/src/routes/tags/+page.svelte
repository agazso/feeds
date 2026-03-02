<script lang="ts">
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
  <title>Tags</title>
</svelte:head>

<div class="tags-page">
  <h1>Browse by Tag</h1>
  {#if data.tags.length > 0}
    <div class="tags-list">
      {#each data.tags as tag}
        <a href="/tags/{tag}" class="tag">#{tag}</a>
      {/each}
    </div>
  {:else}
    <p class="no-results">No tags available.</p>
  {/if}
</div>

<style>
  .tags-page {
    padding: var(--padding);
    max-width: 800px;
    margin: 0 auto;
  }

  h1 {
    font-size: 24px;
    margin-bottom: var(--padding);
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
  }

  .tag {
    display: inline-block;
    padding: var(--half-padding) var(--padding);
    background-color: #88888822;
    border-radius: 4px;
    text-decoration: none;
    color: var(--color);
    font-size: 16px;
  }

  .tag:hover {
    background-color: #88888844;
  }

  .no-results {
    text-align: center;
    color: var(--color-step-30);
    padding: calc(var(--padding) * 4);
  }
</style>
