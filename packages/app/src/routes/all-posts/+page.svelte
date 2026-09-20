<script lang="ts">
  import FeedLinks from '$lib/components/FeedLinks.svelte'
  import PostList from '$lib/components/PostList.svelte'
  import SearchBar from '$lib/components/SearchBar.svelte'
  import Spinner from '$lib/components/Spinner.svelte'
  import { searchPosts } from '$lib/search'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()

  let searchQuery = $state('')
  const isLoading = $state(false)

  const filteredPosts = $derived(searchQuery ? searchPosts(data.posts, searchQuery) : data.posts)

  function handleSearch(query: string) {
    searchQuery = query
  }

  function handleFilter(term: string) {
    searchQuery = term
    // Scroll to top when filtering
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
</script>

<svelte:head>
  <title>All Posts</title>
</svelte:head>
<FeedLinks />

{#if isLoading}
  <div class="loader-container">
    <Spinner />
  </div>
{:else}
  <SearchBar value={searchQuery} onchange={handleSearch} />
  {#if filteredPosts.length > 0}
    <PostList posts={filteredPosts} onfilter={handleFilter} />
  {:else if searchQuery}
    <p class="no-results">No posts found matching "{searchQuery}"</p>
  {:else}
    <p class="no-results">No posts available. Add feeds to feeds.json to get started.</p>
  {/if}
{/if}

<style>
  .loader-container {
    display: flex;
    justify-content: center;
    padding: calc(var(--padding) * 4);
  }

  .no-results {
    text-align: center;
    color: var(--color-step-30);
    padding: calc(var(--padding) * 4);
  }
</style>
