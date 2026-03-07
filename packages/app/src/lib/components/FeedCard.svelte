<script lang="ts">
import type { Feed } from '@feeds/core'

interface Props {
  feed: Feed
}

let { feed }: Props = $props()

let faviconError = $state(false)

$effect(() => {
  faviconError = false
})
</script>

<a href="/feeds/{encodeURIComponent(feed.url)}" class="feed-card">
  <div class="feed-icon-container">
    {#if typeof feed.favicon === 'string' && feed.favicon && !faviconError}
      <img
        src={feed.favicon}
        alt=""
        class="feed-icon"
        onerror={() => faviconError = true}
      />
    {:else}
      <svg class="feed-icon-fallback" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1Z"/>
      </svg>
    {/if}
  </div>
  <div class="feed-info">
    <div class="feed-name">{feed.name}</div>
    <div class="feed-url">{feed.url}</div>
    {#if feed.tags && feed.tags.length > 0}
      <div class="feed-tags">
        {#each feed.tags as tag}
          <span class="tag-chip">#{tag}</span>
        {/each}
      </div>
    {/if}
  </div>
</a>

<style>
  .feed-card {
    display: flex;
    align-items: flex-start;
    gap: var(--padding);
    padding: var(--padding);
    background-color: var(--background-color);
    border: 1px solid #88888844;
    border-radius: 8px;
    text-decoration: none;
    color: var(--color);
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .feed-card:hover {
    background-color: #88888822;
    border-color: #88888888;
  }

  .feed-icon-container {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #88888822;
    border-radius: 8px;
    overflow: hidden;
  }

  .feed-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .feed-icon-fallback {
    width: 24px;
    height: 24px;
    color: #888;
  }

  .feed-info {
    flex-grow: 1;
    min-width: 0;
  }

  .feed-name {
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .feed-url {
    font-size: 13px;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .feed-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: var(--half-padding);
  }

  .tag-chip {
    padding: 2px 8px;
    font-size: 12px;
    border-radius: 12px;
    background: var(--accent-color);
    color: white;
  }
</style>
