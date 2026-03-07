<script lang="ts">
import type { PageData } from './$types'
import SearchBar from '$lib/components/SearchBar.svelte'
import PostList from '$lib/components/PostList.svelte'
import FeedHeader from '$lib/components/FeedHeader.svelte'
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
  <title>{data.feed.name}</title>
</svelte:head>

<div class="feed-page">
  <FeedHeader name={data.feed.name} url={data.feed.url} favicon={typeof data.feed.favicon === 'string' ? data.feed.favicon : null} />

  {#if data.feed.tags && data.feed.tags.length > 0}
    <div class="feed-tags">
      {#each data.feed.tags as tag}
        <a href="/tags/{tag}" class="tag-chip">#{tag}</a>
      {/each}
    </div>
  {/if}

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

  .feed-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
    max-width: var(--max-column-width);
    margin: 0 auto;
    padding: 0 var(--padding);
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

  .no-results {
    text-align: center;
    color: var(--color-step-30);
    padding: calc(var(--padding) * 4);
  }
</style>
