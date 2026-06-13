<script lang="ts">
import type { Post, Feed } from '@feeds/core'
import PostCard from '$lib/components/PostCard.svelte'
import TagSelector from '$lib/components/TagSelector.svelte'
import { buildTagCooccurrence, getSuggestedTags, getContentBasedTags } from '$lib/tags'

interface Props {
  data: {
    url: string
    availableTags: string[]
    feeds: Feed[]
    myfeedPosts: Post[]
    feedTags: string[]  // Tags from the specific feed matching this URL (empty if none)
    feedUrl?: string    // Feed context for the saved post (query param or discovered match)
  }
}

let { data }: Props = $props()

let loading = $state(true)
let saving = $state(false)
let previewPost = $state<Post | null>(null)
let error = $state<string | null>(null)
let success = $state<{ title: string; icon?: string } | null>(null)
let selectedTags = $state<string[]>([])
let embeddingTags = $state<string[]>([])

const cooccurrence = $derived(buildTagCooccurrence(data.feeds, data.myfeedPosts))

// Auto-select feed tags when available
$effect(() => {
  if (data.feedTags.length > 0 && selectedTags.length === 0) {
    selectedTags = [...data.feedTags]
  }
})

// Combine all text fields for tag matching
function getPostText(post: Post | null): string {
  if (!post) return ''
  return [
    post.rssItem?.title,
    post.rssItem?.description,
    post.text,
    post.author?.name
  ].filter(Boolean).join(' ')
}

// feedTags are now provided by the server (exact feed URL matching)

// Fetch embedding-based tags when preview loads
$effect(() => {
  const text = getPostText(previewPost)
  if (text) {
    fetch('/api/suggest-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
      .then(res => res.json())
      .then(result => { embeddingTags = result.tags || [] })
      .catch(() => { embeddingTags = [] })
  } else {
    embeddingTags = []
  }
})

// Combine feed tags (priority) + embedding + content-based tags, deduplicated
const suggestedTags = $derived.by(() => {
  const contentTags = getContentBasedTags(getPostText(previewPost), data.availableTags)
  const all = [...data.feedTags, ...embeddingTags, ...contentTags]
  return [...new Set(all)].slice(0, 5)
})

async function fetchPreview() {
  if (!data.url) {
    loading = false
    error = 'No URL provided'
    return
  }

  // Check sessionStorage for cached preview
  const cacheKey = `share-preview:${data.url}`
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) {
    sessionStorage.removeItem(cacheKey)
    try {
      previewPost = JSON.parse(cached)
      loading = false
      return
    } catch {
      // Invalid JSON, fall through to fetch
    }
  }

  try {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: data.url }),
    })
    const result = await response.json()
    previewPost = result.preview || null
    if (!previewPost) {
      error = 'Could not fetch preview for this URL'
    }
  } catch {
    error = 'Failed to fetch preview'
  } finally {
    loading = false
  }
}

async function save() {
  if (saving) return

  saving = true
  error = null

  try {
    // Build API URL with feedUrl query parameter if available
    const apiUrl = data.feedUrl
      ? `/api/myfeed?feedUrl=${encodeURIComponent(data.feedUrl)}`
      : '/api/myfeed'

    // Reuse the already-enriched preview post so the server doesn't re-enrich
    // (re-running metadata + feed discovery is what made Save slow). Fall back to
    // url-mode only if the preview failed to load.
    const payload = previewPost
      ? { post: previewPost, tags: selectedTags.length > 0 ? selectedTags : undefined }
      : { url: data.url, tags: selectedTags.length > 0 ? selectedTags : undefined }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json()

    if (!response.ok) {
      error = result.error || 'Failed to save'
      return
    }

    success = {
      title: result.post?.title || 'Shared link',
      icon: result.post?.icon,
    }
  } catch {
    error = 'Failed to save'
  } finally {
    saving = false
  }
}

$effect(() => {
  fetchPreview()
})
</script>

<svelte:head>
  <title>Share</title>
</svelte:head>

<div class="share-page">
  {#if success}
    <div class="success-container">
      <div class="success-icon">
        {#if success.icon}
          <img src={success.icon} alt="" class="site-icon" />
        {:else}
          <span class="checkmark">&#10003;</span>
        {/if}
      </div>
      <h2>Saved!</h2>
      <p class="post-title">{success.title}</p>
      {#if selectedTags.length > 0}
        <div class="saved-tags">
          {#each selectedTags as tag}
            <span class="tag">#{tag}</span>
          {/each}
        </div>
      {/if}
      <a href="/myfeed" class="goto-button">Go to My Feed</a>
    </div>
  {:else if loading}
    <div class="loading-container">
      <p>Loading preview...</p>
    </div>
  {:else if error && !previewPost}
    <div class="error-container">
      <p class="error">{error}</p>
      <a href="/share" class="back-link">Try another URL</a>
    </div>
  {:else if previewPost}
    <div class="preview-section">
      <p class="section-label">Preview</p>
      <div class="preview-card">
        <PostCard post={previewPost} />
      </div>
    </div>

    <div class="tags-section">
      <p class="section-label">Tags (optional)</p>
      <TagSelector availableTags={data.availableTags} bind:selectedTags {suggestedTags} />
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button class="save-button" onclick={save} disabled={saving}>
      {saving ? 'Saving...' : 'Save to My Feed'}
    </button>
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
    gap: calc(var(--padding) * 2);
  }

  .loading-container,
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--padding);
  }

  .success-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--padding);
  }

  .success-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .site-icon {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    object-fit: contain;
  }

  .checkmark {
    font-size: 48px;
    color: #27ae60;
  }

  .success-container h2 {
    margin: 0;
    font-size: 24px;
  }

  .post-title {
    color: #888;
    margin: 0;
    max-width: var(--max-column-width);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .saved-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
    justify-content: center;
  }

  .tag {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    background: var(--accent-color);
    border-radius: 16px;
    color: white;
  }

  .goto-button {
    padding: var(--padding);
    background: var(--background-color);
    color: var(--color);
    text-decoration: none;
    border-radius: 4px;
    border: 1px solid #88888888;
    margin-top: var(--padding);
  }

  .goto-button:hover {
    opacity: 0.9;
  }

  .preview-section,
  .tags-section {
    width: 100%;
    max-width: var(--max-column-width);
  }

  .section-label {
    color: #888;
    font-size: 14px;
    margin-bottom: var(--half-padding);
  }

  .preview-card {
    width: 100%;
  }

  .error {
    color: #e74c3c;
    text-align: center;
  }

  .back-link {
    color: var(--color);
  }

  .save-button {
    padding: var(--padding) calc(var(--padding) * 2);
    font-size: 16px;
    min-width: 200px;
  }

  .save-button:disabled {
    opacity: 0.6;
  }
</style>
