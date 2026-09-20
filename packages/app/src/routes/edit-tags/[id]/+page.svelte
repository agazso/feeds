<script lang="ts">
  import type { Post } from '@feeds/core'
  import { goto } from '$app/navigation'
  import Loader from '$lib/components/Loader.svelte'
  import TagSelector from '$lib/components/TagSelector.svelte'
  import { prefix } from '$lib/prefix'
  import { auth } from '$lib/stores/auth.svelte'

  interface Props {
    data: { postId: string }
  }

  const { data }: Props = $props()

  let loading = $state(true)
  let saving = $state(false)
  let post = $state<Post | null>(null)
  let availableTags = $state<string[]>([])
  let selectedTags = $state<string[]>([])
  let error = $state<string | null>(null)

  async function fetchPostData() {
    try {
      const response = await fetch(`${prefix()}/api/myfeed/${encodeURIComponent(data.postId)}`)
      if (!response.ok) {
        error = 'Post not found'
        return
      }
      const result = await response.json()
      post = result.post
      availableTags = result.availableTags
      selectedTags = post?.tags ? [...post.tags] : []
    } catch {
      error = 'Failed to load post'
    } finally {
      loading = false
    }
  }

  async function save() {
    if (saving) return

    saving = true
    error = null

    try {
      const response = await fetch(`${prefix()}/api/myfeed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.postId, tags: selectedTags }),
      })

      if (!response.ok) {
        const result = await response.json()
        error = result.error || 'Failed to save'
        return
      }

      goto(`${prefix()}/myfeed`)
    } catch {
      error = 'Failed to save'
    } finally {
      saving = false
    }
  }

  function cancel() {
    history.back()
  }

  $effect(() => {
    fetchPostData()
  })
</script>

<svelte:head>
  <title>Edit Tags</title>
</svelte:head>

<div class="edit-tags-page">
  {#if loading}
    <div class="loading-container">
      <Loader />
    </div>
  {:else if error && !post}
    <div class="error-container">
      <p class="error">{error}</p>
      <button onclick={cancel}>Go Back</button>
    </div>
  {:else if post}
    <div class="content">
      <h1>Edit Tags</h1>
      <p class="post-title">{post.rssItem?.title || post.author?.name || 'Post'}</p>

      <div class="tags-section">
        <TagSelector {availableTags} bind:selectedTags />
      </div>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <div class="buttons">
        <button class="cancel-button" onclick={cancel} disabled={saving}> Cancel </button>
        {#if auth.canWrite}
          <button class="save-button" onclick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .edit-tags-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 60vh;
    padding: var(--padding);
    padding-top: calc(var(--padding) * 4);
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: calc(var(--padding) * 4);
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--padding);
  }

  .content {
    width: 100%;
    max-width: var(--max-column-width);
    display: flex;
    flex-direction: column;
    gap: calc(var(--padding) * 2);
  }

  h1 {
    margin: 0;
    font-size: 24px;
  }

  .post-title {
    color: #888;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tags-section {
    width: 100%;
  }

  .error {
    color: #e74c3c;
  }

  .buttons {
    display: flex;
    gap: var(--padding);
    justify-content: flex-end;
  }

  .cancel-button,
  .save-button {
    padding: var(--padding) calc(var(--padding) * 2);
    font-size: 16px;
  }

  .cancel-button {
    background: transparent;
    border: 1px solid #88888888;
  }

  .save-button:disabled,
  .cancel-button:disabled {
    opacity: 0.6;
  }
</style>
