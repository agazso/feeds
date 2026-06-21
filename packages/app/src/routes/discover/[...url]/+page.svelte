<script lang="ts">
import type { Post, Feed } from '@feeds/core'
import PostList from '$lib/components/PostList.svelte'
import TagSelector from '$lib/components/TagSelector.svelte'
import FeedHeader from '$lib/components/FeedHeader.svelte'
import { goto } from '$app/navigation'
import { buildTagCooccurrence, getSuggestedTags } from '$lib/tags'
import { auth } from '$lib/stores/auth.svelte'
import { untrack } from 'svelte'

interface Props {
  data: {
    url: string
    availableTags: string[]
    existingFeedUrls: string[]
    feeds: Feed[]
    myfeedPosts: Post[]
  }
}

let { data }: Props = $props()

interface DiscoveredFeed {
  name: string
  url: string
  feedUrl: string
  favicon: string
  itemCount: number
}

let url = $state(untrack(() => data.url) || '')
let loading = $state(false)
let error = $state<string | null>(null)
let discoveredFeed = $state<DiscoveredFeed | null>(null)
let posts = $state<Post[]>([])


// Add feed mode state
let addMode = $state(false)
let selectedTags = $state<string[]>([])
let saving = $state(false)
let feedAdded = $state(false)
let embeddingSuggestions = $state<string[]>([])

const cooccurrence = $derived(buildTagCooccurrence(data.feeds, data.myfeedPosts))
const suggestedTags = $derived(
  [...new Set([...embeddingSuggestions, ...getSuggestedTags(selectedTags, cooccurrence)])].slice(0, 5)
)

// Check if the discovered feed already exists
const feedExists = $derived(
  discoveredFeed ? data.existingFeedUrls.includes(discoveredFeed.feedUrl) || feedAdded : false
)

async function discover() {
  if (!url.trim()) return

  loading = true
  error = null

  // Update browser URL to include the discovered URL
  const encodedUrl = encodeURIComponent(url.trim())
  goto(`/discover/${encodedUrl}`)

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
    fetchEmbeddingSuggestions()
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
  addMode = false
  selectedTags = []
  feedAdded = false
  embeddingSuggestions = []
  // Update URL without the parameter
  goto('/discover')
}

function enterAddMode() {
  addMode = true
  selectedTags = []
}

function cancelAddMode() {
  addMode = false
  selectedTags = []
}

async function fetchEmbeddingSuggestions() {
  if (!discoveredFeed || !posts.length) return
  const text = [
    discoveredFeed.name,
    ...posts.slice(0, 5).map(p => p.rssItem?.title || p.text.slice(0, 100))
  ].join('. ')

  try {
    const res = await fetch('/api/suggest-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    const data = await res.json()
    embeddingSuggestions = data.tags || []
  } catch {
    // Ignore errors, fall back to co-occurrence only
  }
}

async function saveFeed() {
  if (!discoveredFeed) return

  saving = true

  try {
    const response = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feed: {
          name: discoveredFeed.name,
          url: discoveredFeed.url,
          feedUrl: discoveredFeed.feedUrl,
          favicon: discoveredFeed.favicon,
          tags: selectedTags,
        },
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      error = result.error || 'Failed to save feed'
      return
    }

    addMode = false
    selectedTags = []
    feedAdded = true
  } catch {
    error = 'Failed to save feed. Please try again.'
  } finally {
    saving = false
  }
}

// Auto-discover if URL parameter is provided
$effect(() => {
  if (data.url && !discoveredFeed && !loading && !error) {
    url = data.url
    discover()
  }
})

// Reset state when navigating to /discover without URL param (handles menu navigation)
$effect(() => {
  if (!data.url) {
    discoveredFeed = null
    posts = []
    error = null
    url = ''
    addMode = false
    selectedTags = []
    feedAdded = false
    embeddingSuggestions = []
  }
})
</script>

<svelte:head>
  <title>Discover Feed</title>
</svelte:head>

<div class="discover-page">
  {#if discoveredFeed}
    <div class="feed-container">
      <FeedHeader name={discoveredFeed.name} url={discoveredFeed.url} favicon={discoveredFeed.favicon}>
        {#if feedExists}
          <a href="/feeds/{encodeURIComponent(discoveredFeed.feedUrl)}" class="visit-button">Visit feed</a>
        {:else if auth.canWrite}
          <button type="button" class="add-button" onclick={enterAddMode}>Add feed</button>
        {/if}
      </FeedHeader>


      {#if addMode}
        <div class="add-feed-screen">
          <h3>Add "{discoveredFeed.name}" to your feeds</h3>
          <p class="feed-url-info">{discoveredFeed.feedUrl}</p>

          <TagSelector availableTags={data.availableTags} bind:selectedTags {suggestedTags} />

          <div class="actions">
            <button type="button" class="save-button" onclick={saveFeed} disabled={saving}>
              {saving ? 'Saving...' : 'Save Feed'}
            </button>
            <button type="button" class="cancel-button" onclick={cancelAddMode}>Cancel</button>
          </div>

          {#if error}
            <p class="error">{error}</p>
          {/if}
        </div>
      {:else}
        <PostList {posts} />
      {/if}
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

  .add-button,
  .visit-button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
  }

  .visit-button {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    background-color: inherit;
    color: #fff8;
    border: 1px solid #fff8;
    border-radius: 4px;
  }

  .visit-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .add-feed-screen {
    max-width: var(--max-column-width);
    margin: 0 auto;
    padding: var(--padding);
  }

  .add-feed-screen h3 {
    margin: 0 0 var(--half-padding) 0;
    font-size: 18px;
  }

  .feed-url-info {
    color: #888;
    font-size: 12px;
    margin: 0 0 var(--padding) 0;
    word-break: break-all;
  }

  .actions {
    display: flex;
    gap: var(--half-padding);
    margin-top: var(--padding);
  }

  .save-button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
  }

  .save-button:disabled {
    opacity: 0.6;
  }

  .cancel-button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    background: transparent;
    border: 1px solid #88888888;
  }
</style>
