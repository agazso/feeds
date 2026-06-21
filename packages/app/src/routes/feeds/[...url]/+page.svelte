<script lang="ts">
import type { PageData } from './$types'
import SearchBar from '$lib/components/SearchBar.svelte'
import PostList from '$lib/components/PostList.svelte'
import FeedHeader from '$lib/components/FeedHeader.svelte'
import TagSelector from '$lib/components/TagSelector.svelte'
import { searchPosts } from '$lib/search'
import { buildTagCooccurrence, getSuggestedTags } from '$lib/tags'
import { auth } from '$lib/stores/auth.svelte'

let { data }: { data: PageData } = $props()

let searchQuery = $state('')
let isEditingTags = $state(false)
let editedTags = $state<string[]>([])
let isSaving = $state(false)

const cooccurrence = $derived(buildTagCooccurrence(data.feeds, data.myfeedPosts))
const suggestedTags = $derived(getSuggestedTags(editedTags, cooccurrence))

const filteredPosts = $derived(searchQuery ? searchPosts(data.posts, searchQuery) : data.posts)

function handleSearch(query: string) {
  searchQuery = query
}

function handleFilter(term: string) {
  searchQuery = term
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function startEditingTags() {
  editedTags = [...(data.feed.tags || [])]
  isEditingTags = true
}

function cancelEditingTags() {
  isEditingTags = false
  editedTags = []
}

async function saveTags() {
  isSaving = true
  try {
    const response = await fetch(`/api/feeds/${encodeURIComponent(data.feed.feedUrl)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: editedTags }),
    })

    if (response.ok) {
      data.feed.tags = editedTags
      isEditingTags = false
    } else {
      const error = await response.json()
      alert(`Failed to save tags: ${error.error}`)
    }
  } catch (e) {
    alert('Failed to save tags')
  } finally {
    isSaving = false
  }
}
</script>

<svelte:head>
  <title>{data.feed.name}</title>
</svelte:head>

<div class="feed-page">
  <FeedHeader name={data.feed.name} url={data.feed.url} favicon={typeof data.feed.favicon === 'string' ? data.feed.favicon : null} />

  <div class="tags-section">
    {#if isEditingTags}
      <div class="tag-editor">
        <TagSelector
          availableTags={data.availableTags}
          bind:selectedTags={editedTags}
          {suggestedTags}
        />
        <div class="tag-editor-actions">
          <button type="button" onclick={cancelEditingTags} disabled={isSaving}>Cancel</button>
          <button type="button" class="save-button" onclick={saveTags} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    {:else}
      <div class="feed-tags">
        {#if data.feed.tags && data.feed.tags.length > 0}
          {#each data.feed.tags as tag}
            <a href="/tags/{tag}" class="tag-chip">#{tag}</a>
          {/each}
        {/if}
        {#if auth.canWrite}
          <button type="button" class="edit-tags-button" onclick={startEditingTags}>
            Edit tags
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <SearchBar value={searchQuery} onchange={handleSearch} />

  {#if filteredPosts.length > 0}
    <PostList posts={filteredPosts} onfilter={handleFilter} />
  {:else if searchQuery}
    <p class="no-results">No posts found matching "{searchQuery}"</p>
  {:else}
    <p class="no-results">No posts available from this feed.</p>
  {/if}
</div>

<style>
  .feed-page {
    width: 100%;
  }

  .tags-section {
    max-width: var(--max-column-width);
    margin: 0 auto;
    padding: 0 var(--padding);
  }

  .feed-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--half-padding);
  }

  .tag-chip {
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 12px;
    background: var(--accent-color);
    color: white;
    text-decoration: none;
  }

  .tag-chip:hover {
    opacity: 0.8;
  }

  .edit-tags-button {
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 12px;
    background: transparent;
    border: 1px dashed var(--color-step-30);
    color: var(--color-step-30);
    cursor: pointer;
  }

  .edit-tags-button:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .tag-editor {
    display: flex;
    flex-direction: column;
    gap: var(--padding);
  }

  .tag-editor-actions {
    display: flex;
    gap: var(--half-padding);
    justify-content: flex-end;
  }

  .tag-editor-actions button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    border-radius: 4px;
    cursor: pointer;
  }

  .tag-editor-actions .save-button {
    background: var(--accent-color);
    color: white;
    border: none;
  }

  .tag-editor-actions .save-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .tag-editor-actions .save-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .no-results {
    text-align: center;
    color: var(--color-step-30);
    padding: calc(var(--padding) * 4);
  }
</style>
