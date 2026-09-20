<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    name: string
    url: string
    favicon?: string | null
    children?: Snippet
  }

  const { name, url, favicon, children }: Props = $props()

  let faviconError = $state(false)

  // Reset error when favicon changes
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- tracks favicon
    favicon
    faviconError = false
  })
</script>

<div class="feed-header">
  {#if favicon && !faviconError}
    <img src={favicon} alt="" class="feed-icon" onerror={() => (faviconError = true)} />
  {/if}
  <div class="feed-info">
    <h2>{name}</h2>
    <a href={url} target="_blank" rel="noopener noreferrer" class="feed-url">{url}</a>
  </div>
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .feed-header {
    display: flex;
    align-items: center;
    gap: var(--padding);
    padding: var(--padding);
    border-radius: 4px;
    max-width: var(--max-column-width);
    margin: var(--padding) auto;
  }

  .feed-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    object-fit: contain;
  }

  .feed-info {
    flex-grow: 1;
  }

  .feed-info h2 {
    margin: 0;
    font-size: 18px;
  }

  .feed-url {
    color: #888;
    font-size: 12px;
    text-decoration: none;
    word-break: break-all;
  }

  .feed-url:hover {
    text-decoration: underline;
  }
</style>
