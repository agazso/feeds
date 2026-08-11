<script lang="ts">
import { normalizeUrl, type Post } from '@feeds/core'
import { goto } from '$app/navigation'
import { debounce } from '$lib/search'
import PostCard from '$lib/components/PostCard.svelte'

interface DiscoveredFeed {
  name: string
  url: string
  feedUrl: string
  favicon: string
}

let url = $state('')
let previewPost = $state<Post | null>(null)
let previewLoading = $state(false)
let discoveredFeed = $state<DiscoveredFeed | null>(null)
let faviconError = $state(false)

async function fetchPreview(urlValue: string) {
  const normalizedUrl = normalizeUrl(urlValue)
  if (!normalizedUrl) {
    previewPost = null
    discoveredFeed = null
    faviconError = false
    return
  }

  previewLoading = true
  try {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlValue }),
    })
    const result = await response.json()
    previewPost = result.preview || null
    discoveredFeed = result.feed || null
    faviconError = false

    // Use feed favicon as fallback if page favicon is missing
    if (previewPost && !previewPost.author?.image?.uri && discoveredFeed?.favicon) {
      previewPost = {
        ...previewPost,
        author: {
          ...previewPost.author,
          name: previewPost.author?.name || '',
          uri: previewPost.author?.uri || '',
          image: { uri: discoveredFeed.favicon }
        }
      }
    }
  } catch {
    previewPost = null
    discoveredFeed = null
    faviconError = false
  } finally {
    previewLoading = false
  }
}

const debouncedFetchPreview = debounce(fetchPreview, 500)

function handleUrlInput() {
  debouncedFetchPreview(url)
}

function handleSubmit(e: SubmitEvent) {
  e.preventDefault()
  if (!url.trim()) return

  // Store preview in sessionStorage before navigating
  if (previewPost) {
    sessionStorage.setItem(`share-preview:${url.trim()}`, JSON.stringify(previewPost))
  }

  goto(`/share/${encodeURIComponent(url.trim())}`)
}
</script>

<svelte:head>
  <title>Share</title>
</svelte:head>

<div class="share-page">
  <form class="share-form" onsubmit={handleSubmit}>
    <input
      type="url"
      name="url"
      class="url-input"
      placeholder="Paste URL to share..."
      bind:value={url}
      oninput={handleUrlInput}
      required
    />
    <button type="submit" class="share-button" disabled={!url}>
      Continue
    </button>
  </form>

    {#if discoveredFeed}
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
          <span class="feed-name">{discoveredFeed.name}</span>
          <span class="feed-url">{discoveredFeed.feedUrl}</span>
        </div>
        <a href="/discover/{encodeURIComponent(discoveredFeed.url)}" class="view-feed-link">
          View Feed
        </a>
      </div>
    {/if}

    {#if previewLoading}
      <div class="preview-section">
        <p class="preview-label">Loading preview...</p>
      </div>
    {:else if previewPost}
      <div class="preview-section">
        <p class="preview-label">Preview</p>
        <div class="preview-card">
          <PostCard post={previewPost} />
        </div>
      </div>
    {/if}
</div>

<style>
  .share-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 60vh;
    padding: var(--padding);
    padding-top: calc(var(--padding) * 4);
  }

  .share-form {
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
  }

  .url-input {
    appearance: none;
    /* display:block, not flex — iOS Safari collapses a form control set to
       display:flex to zero width (it renders fine everywhere else). The input
       still grows because it's a flex item of .share-form. */
    display: block;
    flex-grow: 1;
    min-width: 0;
    font-size: 16px;
    border: 0;
    padding: 0;
    background-color: var(--background-color);
    color: var(--color);
  }

  .url-input:disabled {
    opacity: 0.6;
  }

  .share-button {
    padding: var(--half-padding) var(--padding);
    min-width: 80px;
    font-size: 14px;
  }

  .share-button:disabled {
    opacity: 0.6;
  }

  .preview-section {
    width: 100%;
    max-width: var(--max-column-width);
    margin-top: var(--padding);
  }

  .preview-label {
    color: #888;
    font-size: 14px;
    margin-bottom: var(--half-padding);
  }

  .preview-card {
    width: 100%;
  }

  .feed-header {
    display: flex;
    align-items: center;
    gap: var(--padding);
    padding: var(--padding);
    border: 1px solid #88888888;
    border-radius: 4px;
    margin-top: var(--padding);
    width: 100%;
    max-width: var(--max-column-width);
  }

  .feed-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: contain;
  }

  .feed-info {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .feed-name {
    font-weight: 500;
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .feed-url {
    color: #888;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .view-feed-link {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    background: transparent;
    border: 1px solid #88888888;
    border-radius: 4px;
    text-decoration: none;
    color: var(--color);
    white-space: nowrap;
  }

  .view-feed-link:hover {
    opacity: 0.8;
  }
</style>
