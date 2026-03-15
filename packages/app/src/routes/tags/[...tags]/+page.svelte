<script lang="ts">
import type { PageData } from './$types'
import type { Post } from '@feeds/core'
import SearchBar from '$lib/components/SearchBar.svelte'
import PostList from '$lib/components/PostList.svelte'
import Loader from '$lib/components/Loader.svelte'
import { searchPosts } from '$lib/search'
import { formatTagsForPath } from '$lib/tags'
import { goto } from '$app/navigation'
import { untrack } from 'svelte'

let { data }: { data: PageData } = $props()

let searchQuery = $state('')
let isLoading = $state(true)

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
    const tagsParam = tags.map(encodeURIComponent).join('+')
    const response = await fetch(`/api/tags?tags=${tagsParam}`)
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

function handleTagClick(tag: string) {
  const isRemoving = selectedTags.includes(tag)

  if (isRemoving) {
    const newTags = selectedTags.filter((t) => t !== tag)

    // Check if new tags still contain all base tags (can filter from cache)
    const canUseCache = baseTags.every((t) => newTags.includes(t))

    if (newTags.length === 0) {
      goto('/tags')
    } else if (canUseCache) {
      // Filter client-side from cached posts
      selectedTags = newTags
      goto(`/tags/${formatTagsForPath(newTags)}`, { replaceState: true })
    } else {
      // Need broader data - navigate and load via API
      goto(`/tags/${formatTagsForPath(newTags)}`)
    }
  } else {
    // Adding a tag - always filter client-side
    selectedTags = [...selectedTags, tag]
    goto(`/tags/${formatTagsForPath(selectedTags)}`, { replaceState: true })
  }
}
</script>

<svelte:head>
  <title>Tags: {selectedTags.join(' + ')}</title>
</svelte:head>

<div class="tags-header">
  <div class="selected-tags">
    {#each selectedTags as tag}
      <button class="tag selected" onclick={() => handleTagClick(tag)}>#{tag} &times;</button>
    {/each}
  </div>
  <div class="available-tags">
    {#each allTags.filter((t) => !selectedTags.includes(t)) as tag}
      <button class="tag" onclick={() => handleTagClick(tag)}>+{tag}</button>
    {/each}
  </div>
</div>

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
    padding: var(--padding);
    background-color: var(--color-step-10);
    border-bottom: 1px solid #88888822;
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
    margin-bottom: var(--half-padding);
  }

  .available-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
    margin-bottom: var(--half-padding);
  }

  .tag {
    display: inline-block;
    padding: var(--half-padding) var(--padding);
    background-color: #88888822;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: var(--color);
  }

  .tag:hover {
    background-color: #88888844;
  }

  .tag.selected {
    background-color: #88888866;
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
