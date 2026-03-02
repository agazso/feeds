<script lang="ts">
import type { PageData } from './$types'
import SearchBar from '$lib/components/SearchBar.svelte'
import PostList from '$lib/components/PostList.svelte'
import { searchPosts } from '$lib/search'
import { formatTagsForPath } from '$lib/tags'
import { goto } from '$app/navigation'

let { data }: { data: PageData } = $props()

let searchQuery = $state('')

const filteredPosts = $derived(searchQuery ? searchPosts(data.posts, searchQuery) : data.posts)

function handleSearch(query: string) {
  searchQuery = query
}

function handleFilter(term: string) {
  searchQuery = term
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleTagClick(tag: string) {
  if (data.selectedTags.includes(tag)) {
    // Remove tag
    const newTags = data.selectedTags.filter((t) => t !== tag)
    if (newTags.length === 0) {
      goto('/tags')
    } else {
      goto(`/tags/${formatTagsForPath(newTags)}`)
    }
  } else {
    // Add tag
    const newTags = [...data.selectedTags, tag]
    goto(`/tags/${formatTagsForPath(newTags)}`)
  }
}
</script>

<svelte:head>
  <title>Tags: {data.selectedTags.join(' + ')}</title>
</svelte:head>

<div class="tags-header">
  <div class="selected-tags">
    {#each data.selectedTags as tag}
      <button class="tag selected" onclick={() => handleTagClick(tag)}>#{tag} &times;</button>
    {/each}
  </div>
  <div class="available-tags">
    {#each data.allTags.filter((t) => !data.selectedTags.includes(t)) as tag}
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
