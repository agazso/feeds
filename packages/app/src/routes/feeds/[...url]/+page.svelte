<script lang="ts">
import type { PageData } from './$types'
import SearchBar from '$lib/components/SearchBar.svelte'
import PostList from '$lib/components/PostList.svelte'
import { searchPosts } from '$lib/search'

let { data }: { data: PageData } = $props()

let searchQuery = $state('')
let faviconError = $state(false)

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
  <div class="feed-header">
    {#if typeof data.feed.favicon === 'string' && data.feed.favicon && !faviconError}
      <img
        src={data.feed.favicon}
        alt=""
        class="feed-icon"
        onerror={() => faviconError = true}
      />
    {/if}
    <div class="feed-info">
      <h1>{data.feed.name}</h1>
      <a href={data.feed.url} target="_blank" rel="noopener noreferrer" class="feed-url">
        {data.feed.url}
      </a>
      {#if data.feed.tags && data.feed.tags.length > 0}
        <div class="feed-tags">
          {#each data.feed.tags as tag}
            <a href="/tags/{tag}" class="tag-chip">#{tag}</a>
          {/each}
        </div>
      {/if}
    </div>
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

  .feed-header {
    display: flex;
    align-items: center;
    gap: var(--padding);
    padding: var(--padding);
    max-width: var(--max-column-width);
    margin: var(--padding) auto;
  }

  .feed-icon {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    object-fit: contain;
  }

  .feed-info {
    flex-grow: 1;
  }

  .feed-info h1 {
    margin: 0;
    font-size: 24px;
  }

  .feed-url {
    color: #888;
    font-size: 14px;
    text-decoration: none;
    word-break: break-all;
  }

  .feed-url:hover {
    text-decoration: underline;
  }

  .feed-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
    margin-top: var(--half-padding);
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
