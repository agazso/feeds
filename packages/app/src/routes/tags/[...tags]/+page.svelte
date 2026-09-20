<script lang="ts">
  import { untrack } from 'svelte'
  import { slide } from 'svelte/transition'
  import type { Post } from '@feeds/core'
  import { Add, ArrowsHorizontal } from 'carbon-icons-svelte'
  import { goto } from '$app/navigation'
  import FeedLinks from '$lib/components/FeedLinks.svelte'
  import Loader from '$lib/components/Loader.svelte'
  import PostList from '$lib/components/PostList.svelte'
  import SearchBar from '$lib/components/SearchBar.svelte'
  import TagChip from '$lib/components/TagChip.svelte'
  import { prefix } from '$lib/prefix'
  import { searchPosts } from '$lib/search'
  import { formatTagsForPath } from '$lib/tags'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()

  let searchQuery = $state('')
  let isLoading = $state(true)
  let openPanel: 'add' | 'replace' | null = $state(null)

  // Local state for selected tags - allows client-side filtering when adding tags
  let selectedTags = $state<string[]>(untrack(() => data.selectedTags))

  // Track the base tags from server load (the "broadest" cached state)
  let baseTags = $state<string[]>(untrack(() => data.selectedTags))
  let cachedPosts = $state<Post[]>([])
  let allTags = $state<string[]>([])
  let feedUrlToPageUrl = $state<Record<string, string>>({})

  async function loadTagData(tags: string[]) {
    isLoading = true
    try {
      const tagsParam = tags.map(encodeURIComponent).join('%2B')
      const response = await fetch(`${prefix()}/api/tags?tags=${tagsParam}`)
      const result = await response.json()
      cachedPosts = result.posts
      allTags = result.allTags
      feedUrlToPageUrl = result.feedUrlToPageUrl
      baseTags = [...tags]
    } finally {
      isLoading = false
    }
  }

  // Load data when selectedTags change from navigation
  $effect(() => {
    const newTags = data.selectedTags
    selectedTags = [...newTags]
    loadTagData(newTags)
  })

  const addableTags = $derived(allTags.filter((t) => !selectedTags.includes(t)))

  // Filter from cached posts
  const filteredPosts = $derived.by(() => {
    const tagFiltered = cachedPosts.filter((post) =>
      selectedTags.every((tag) => post.tags?.includes(tag)),
    )
    return searchQuery ? searchPosts(tagFiltered, searchQuery) : tagFiltered
  })

  function handleSearch(query: string) {
    searchQuery = query
  }

  function handleFilter(term: string) {
    searchQuery = term
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRemoveTag(tag: string) {
    const newTags = selectedTags.filter((t) => t !== tag)

    // Check if new tags still contain all base tags (can filter from cache)
    const canUseCache = baseTags.every((t) => newTags.includes(t))

    if (newTags.length === 0) {
      goto(`${prefix()}/tags`)
    } else if (canUseCache) {
      // Filter client-side from cached posts
      selectedTags = newTags
      goto(`${prefix()}/tags/${formatTagsForPath(newTags)}`, { replaceState: true })
    } else {
      // Need broader data - navigate and load via API
      goto(`${prefix()}/tags/${formatTagsForPath(newTags)}`)
    }
  }

  function togglePanel(panel: 'add' | 'replace') {
    openPanel = openPanel === panel ? null : panel
  }

  function handleAddTag(tag: string) {
    selectedTags = [...selectedTags, tag]
    openPanel = null
    goto(`${prefix()}/tags/${formatTagsForPath(selectedTags)}`, { replaceState: true })
  }

  function handleReplaceTag(tag: string) {
    openPanel = null
    goto(`${prefix()}/tags/${encodeURIComponent(tag)}`)
  }
</script>

<svelte:head>
  <title>Tags: {selectedTags.join(' + ')}</title>
</svelte:head>
<FeedLinks />

<div class="tags-header">
  <div class="selected-tags">
    {#each selectedTags as tag (tag)}
      <TagChip {tag} onremove={() => handleRemoveTag(tag)} />
    {/each}
  </div>

  <!-- Always rendered, disabled when unusable: hiding them resized the header on
       every load, so a reload made it jump twice. -->
  <div class="tag-actions">
    <button
      class="icon-btn"
      class:active={openPanel === 'add'}
      disabled={addableTags.length === 0}
      onclick={() => togglePanel('add')}
      aria-label="Add tag"
    >
      <Add size={20} />
    </button>

    <button
      class="icon-btn"
      class:active={openPanel === 'replace'}
      disabled={allTags.length < 2}
      onclick={() => togglePanel('replace')}
      aria-label="Switch tag"
    >
      <ArrowsHorizontal size={20} />
    </button>
  </div>
</div>

{#if openPanel}
  <div class="tag-panel" transition:slide={{ duration: 150 }}>
    <div class="panel-header">{openPanel === 'add' ? 'Add tag' : 'Switch tag'}</div>
    <div class="tags-list">
      {#each addableTags as tag (tag)}
        <button
          class="tag-option"
          onclick={() => (openPanel === 'add' ? handleAddTag(tag) : handleReplaceTag(tag))}
        >
          #{tag}
        </button>
      {/each}
    </div>
  </div>
{/if}

<SearchBar value={searchQuery} onchange={handleSearch} />

{#if isLoading}
  <div class="loading-container">
    <Loader dimension="large" />
  </div>
{:else if filteredPosts.length > 0}
  <PostList posts={filteredPosts} onfilter={handleFilter} {feedUrlToPageUrl} />
{:else if searchQuery}
  <p class="no-results">No posts found matching "{searchQuery}"</p>
{:else}
  <p class="no-results">No posts available for these tags.</p>
{/if}

<style>
  .tags-header {
    display: flex;
    align-items: center;
    gap: var(--padding);
    padding: var(--padding);
    background-color: var(--color-step-10);
    border-bottom: 1px solid #88888822;
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
  }

  .tag-actions {
    display: flex;
    gap: var(--half-padding);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: #88888822;
    border: none;
    border-radius: 4px;
    color: var(--color);
    cursor: pointer;
  }

  .icon-btn:hover:not(:disabled) {
    background-color: #88888844;
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .icon-btn.active {
    background-color: var(--accent-color);
    color: white;
  }

  .tag-panel {
    background-color: var(--color-step-10);
    border-bottom: 1px solid #88888822;
    padding: var(--padding);
  }

  .panel-header {
    font-size: 12px;
    color: var(--color-step-30);
    padding-bottom: var(--half-padding);
    margin-bottom: var(--half-padding);
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
  }

  .tag-option {
    padding: var(--half-padding) var(--padding);
    background: #88888822;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: var(--color);
  }

  .tag-option:hover {
    background-color: #88888844;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: calc(var(--padding) * 4);
  }

  .no-results {
    text-align: center;
    color: var(--color-step-30);
    padding: calc(var(--padding) * 4);
  }
</style>
