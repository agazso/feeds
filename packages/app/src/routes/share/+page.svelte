<script lang="ts">
import type { ActionData } from './$types'
import type { Post } from '@feeds/core'
import { enhance } from '$app/forms'
import { debounce } from '$lib/search'
import PostCard from '$lib/components/PostCard.svelte'

let { form }: { form: ActionData } = $props()

let loading = $state(false)
let url = $state('')
let previewPost = $state<Post | null>(null)
let previewLoading = $state(false)

async function fetchPreview(urlValue: string) {
  if (!urlValue.trim()) {
    previewPost = null
    return
  }

  try {
    new URL(urlValue)
  } catch {
    previewPost = null
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
  } catch {
    previewPost = null
  } finally {
    previewLoading = false
  }
}

const debouncedFetchPreview = debounce(fetchPreview, 500)

function handleUrlInput() {
  debouncedFetchPreview(url)
}
</script>

<svelte:head>
  <title>Share</title>
</svelte:head>

<div class="share-page">
  {#if form?.success}
    <div class="success-container">
      <div class="success-icon">
        {#if form.post?.icon}
          <img src={form.post.icon} alt="" class="site-icon" />
        {:else}
          <span class="checkmark">&#10003;</span>
        {/if}
      </div>
      <h2>Shared!</h2>
      <p class="post-title">{form.post?.title}</p>
      <a href="/myfeed" class="goto-button">Go to My Feed</a>
    </div>
  {:else}
    <form
      method="POST"
      action="?/share"
      class="share-form"
      use:enhance={() => {
        loading = true
        return async ({ update }) => {
          loading = false
          await update()
        }
      }}
    >
      <input
        type="url"
        name="url"
        class="url-input"
        placeholder="Paste URL to share..."
        bind:value={url}
        oninput={handleUrlInput}
        required
        disabled={loading}
      />
      <button type="submit" class="share-button" disabled={loading || !url}>
        {loading ? 'Sharing...' : 'Share'}
      </button>
    </form>

    {#if form?.error}
      <p class="error">{form.error}</p>
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

  .share-button {
    padding: var(--half-padding) var(--padding);
    min-width: 80px;
    font-size: 14px;
  }

  .share-button:disabled {
    opacity: 0.6;
  }

  .error {
    color: #e74c3c;
    margin-top: var(--padding);
    text-align: center;
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
</style>
