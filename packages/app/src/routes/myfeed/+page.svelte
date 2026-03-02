<script lang="ts">
import type { PageData } from './$types'
import SearchBar from '$lib/components/SearchBar.svelte'
import PostList from '$lib/components/PostList.svelte'
import { searchPosts } from '$lib/search'

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
</script>

<svelte:head>
  <title>My Feed</title>
</svelte:head>

<SearchBar value={searchQuery} onchange={handleSearch} />
{#if filteredPosts.length > 0}
  <PostList posts={filteredPosts} onfilter={handleFilter} />
{:else if searchQuery}
  <p class="no-results">No posts found matching "{searchQuery}"</p>
{:else}
  <p class="no-results">No posts available.</p>
{/if}

<style>
  .no-results {
    text-align: center;
    color: var(--color-step-30);
    padding: calc(var(--padding) * 4);
  }
</style>
