<script lang="ts">
  import { untrack } from 'svelte'
  import PostList from '$lib/components/PostList.svelte'
  import SearchBar from '$lib/components/SearchBar.svelte'
  import { searchPosts } from '$lib/search'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()

  let posts = $state(untrack(() => data.posts))
  let searchQuery = $state('')

  const filteredPosts = $derived(searchQuery ? searchPosts(posts, searchQuery) : posts)

  function handleSearch(query: string) {
    searchQuery = query
  }

  function handleFilter(term: string) {
    searchQuery = term
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRemove(postId: string) {
    posts = posts.filter((p) => String(p._id) !== postId)
  }
</script>

<svelte:head>
  <title>My Feed</title>
</svelte:head>

<SearchBar value={searchQuery} onchange={handleSearch} />
{#if filteredPosts.length > 0}
  <PostList
    posts={filteredPosts}
    onfilter={handleFilter}
    onremove={handleRemove}
    feedUrlToPageUrl={data.feedUrlToPageUrl}
  />
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
