<script lang="ts">
import type { Post } from '@feeds/core'
import PostList from '$lib/components/PostList.svelte'

interface Props {
  data: { url: string }
}

let { data }: Props = $props()

interface DiscoveredFeed {
  name: string
  url: string
  feedUrl: string
  favicon: string
  itemCount: number
}

let url = $state(data.url || '')
let loading = $state(false)
let error = $state<string | null>(null)
let discoveredFeed = $state<DiscoveredFeed | null>(null)
let posts = $state<Post[]>([])
let faviconError = $state(false)

async function discover() {
  if (!url.trim()) return

  loading = true
  error = null

  // Update browser URL to include the discovered URL
  const encodedUrl = encodeURIComponent(url.trim())
  history.pushState({}, '', `/discover/${encodedUrl}`)

  try {
    const response = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    })

    const responseData = await response.json()

    if (!response.ok) {
      error = responseData.error || 'Failed to discover feed'
      return
    }

    discoveredFeed = responseData.feed
    posts = responseData.posts
  } catch {
    error = 'Failed to discover feed. Please check the URL and try again.'
  } finally {
    loading = false
  }
}

function reset() {
  discoveredFeed = null
  posts = []
  error = null
  url = ''
  faviconError = false
  // Update URL without the parameter
  history.replaceState({}, '', '/discover')
}

// Auto-discover if URL parameter is provided
$effect(() => {
  if (data.url && !discoveredFeed && !loading && !error) {
    url = data.url
    discover()
  }
})
</script>

<svelte:head>
  <title>Discover Feed</title>
</svelte:head>

<div class="discover-page">
  {#if discoveredFeed}
    <div class="feed-container">
      <div class="feed-header">
        {#if discoveredFeed.favicon && !faviconError}
          <img
            src={discoveredFeed.favicon}
            alt=""
            class="feed-icon"
            onerror={() => faviconError = true}
          />
        {/if}
        <div class="feed-info">
          <h2>{discoveredFeed.name}</h2>
          <p class="feed-url">{discoveredFeed.feedUrl}</p>
        </div>
        <button type="button" class="reset-button" onclick={reset}>Clear</button>
      </div>

      <PostList {posts} />
    </div>
  {:else}
    <div class="discover-form">
      <input
        type="url"
        class="url-input"
        placeholder="Enter website URL (e.g., https://news.ycombinator.com/)"
        bind:value={url}
        disabled={loading}
        onkeydown={(e) => e.key === 'Enter' && discover()}
      />
      <button type="button" class="discover-button" disabled={loading || !url} onclick={discover}>
        {loading ? 'Discovering...' : 'Discover Feed'}
      </button>
    </div>

    {#if loading}
      <p class="loading-text">Discovering feed and enriching items...</p>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}
  {/if}
</div>

<style>
  .discover-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 60vh;
  }

  .discover-form {
    display: flex;
    flex-direction: row;
    justify-content: stretch;
    align-items: center;
    width: 100%;
    max-width: var(--max-column-width);
    border-color: #88888888;
    border-width: 1px;
    border-radius: 4px;
    border-style: solid;
    padding: var(--padding);
    padding-right: var(--half-padding);
    background-color: var(--background-color);
    color: var(--color);
    height: 48px;
    gap: var(--half-padding);
    margin: var(--padding);
  }

  .url-input {
    appearance: none;
    display: flex;
    flex-grow: 1;
    font-size: 16px;
    border: 0;
    padding: 0;
    background-color: var(--background-color);
    color: var(--color);
  }

  .url-input:disabled {
    opacity: 0.6;
  }

  .discover-button {
    padding: var(--half-padding) var(--padding);
    min-width: 120px;
    font-size: 14px;
  }

  .discover-button:disabled {
    opacity: 0.6;
  }

  .loading-text {
    color: #888;
    margin-top: var(--padding);
    text-align: center;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .error {
    color: #e74c3c;
    margin-top: var(--padding);
    text-align: center;
  }

  .feed-container {
    width: 100%;
  }

  .feed-header {
    display: flex;
    align-items: center;
    gap: var(--padding);
    padding: var(--padding);
    border-radius: 4px;
    max-width: var(--max-column-width);
    margin: var(--padding);
    margin-left: auto;
    margin-right: auto;
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
    margin: 0;
    word-break: break-all;
  }

  .reset-button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    background: transparent;
    border: 1px solid #88888888;
  }
</style>
