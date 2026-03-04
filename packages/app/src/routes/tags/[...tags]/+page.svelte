<script lang="ts">
import type { PageData } from './$types'
import SearchBar from '$lib/components/SearchBar.svelte'
import PostList from '$lib/components/PostList.svelte'
import { searchPosts } from '$lib/search'
import { formatTagsForPath } from '$lib/tags'
import { goto } from '$app/navigation'

let { data }: { data: PageData } = $props()

let searchQuery = $state('')

// Local state for selected tags - allows client-side filtering when adding tags
let selectedTags = $state<string[]>(data.selectedTags)

// Track the base tags from server load (the "broadest" cached state)
let baseTags = $state<string[]>(data.selectedTags)
let cachedPosts = $state(data.posts)

// Sync cache when data changes from server navigation
$effect(() => {
  baseTags = [...data.selectedTags]
  cachedPosts = data.posts
  selectedTags = [...data.selectedTags]
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
      history.replaceState({}, '', `/tags/${formatTagsForPath(newTags)}`)
    } else {
      // Need broader data from server
      goto(`/tags/${formatTagsForPath(newTags)}`)
    }
  } else {
    // Adding a tag - always filter client-side
    selectedTags = [...selectedTags, tag]
    history.replaceState({}, '', `/tags/${formatTagsForPath(selectedTags)}`)
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
    {#each data.allTags.filter((t) => !selectedTags.includes(t)) as tag}
      <button class="tag" onclick={() => handleTagClick(tag)}>+{tag}</button>
    {/each}
  </div>
  <div class="feed-count">{data.feedCount} feeds</div>
</div>

<SearchBar value={searchQuery} onchange={handleSearch} />
{#if filteredPosts.length > 0}
  <PostList posts={filteredPosts} onfilter={handleFilter} />
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

  .feed-count {
    font-size: 12px;
    color: var(--color-step-30);
  }

  .no-results {
    text-align: center;
    color: var(--color-step-30);
    padding: calc(var(--padding) * 4);
  }
</style>
