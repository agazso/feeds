<script lang="ts">
  import type { Feed } from '@feeds/core'
  import FeedCard from '$lib/components/FeedCard.svelte'
  import FeedLinks from '$lib/components/FeedLinks.svelte'
  import SearchBar from '$lib/components/SearchBar.svelte'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()

  let searchQuery = $state('')
  let sortBy = $state<'name' | 'tag'>('name')

  function matchesFeed(feed: Feed, query: string): boolean {
    const lowerQuery = query.toLowerCase()
    if (feed.name.toLowerCase().includes(lowerQuery)) return true
    if (feed.url.toLowerCase().includes(lowerQuery)) return true
    if (feed.feedUrl.toLowerCase().includes(lowerQuery)) return true
    if (feed.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))) return true
    return false
  }

  function sortFeeds(feeds: Feed[], by: 'name' | 'tag'): Feed[] {
    return [...feeds].sort((a, b) => {
      if (by === 'name') {
        return a.name.localeCompare(b.name)
      } else {
        const tagA = a.tags?.[0] ?? ''
        const tagB = b.tags?.[0] ?? ''
        const tagCompare = tagA.localeCompare(tagB)
        if (tagCompare !== 0) return tagCompare
        return a.name.localeCompare(b.name)
      }
    })
  }

  const filteredFeeds = $derived.by(() => {
    let feeds = data.feeds
    if (searchQuery) {
      feeds = feeds.filter((feed) => matchesFeed(feed, searchQuery))
    }
    return sortFeeds(feeds, sortBy)
  })

  function handleSearch(query: string) {
    searchQuery = query
  }

  function toggleSort() {
    sortBy = sortBy === 'name' ? 'tag' : 'name'
  }
</script>

<svelte:head>
  <title>Feeds</title>
</svelte:head>
<!-- Every followed feed, so this page works as the directory a reader subscribes from. -->
<FeedLinks feeds={data.feeds} />

<div class="feeds-page">
  <div class="page-header">
    <h1>Feeds</h1>
    <button class="sort-button" onclick={toggleSort}>
      Sort: {sortBy === 'name' ? 'Name' : 'Tag'}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M3 5L6 2L9 5H3Z" />
        <path d="M3 7L6 10L9 7H3Z" />
      </svg>
    </button>
  </div>

  <SearchBar value={searchQuery} onchange={handleSearch} />

  {#if filteredFeeds.length > 0}
    <div class="feeds-grid">
      {#each filteredFeeds as feed (feed.feedUrl)}
        <FeedCard {feed} />
      {/each}
    </div>
  {:else if searchQuery}
    <p class="no-results">No feeds found matching "{searchQuery}"</p>
  {:else}
    <p class="no-results">No feeds configured.</p>
  {/if}
</div>

<style>
  .feeds-page {
    width: 100%;
    padding-bottom: var(--padding);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--padding);
    max-width: var(--max-column-width);
    margin: 0 auto;
  }

  .page-header h1 {
    margin: 0;
    font-size: 24px;
  }

  .sort-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--half-padding) var(--padding);
    background-color: #88888822;
    border: 1px solid #88888844;
    border-radius: 4px;
    color: var(--color);
    font-size: 14px;
    cursor: pointer;
    min-width: unset;
  }

  .sort-button:hover {
    background-color: #88888844;
  }

  .feeds-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--padding);
    padding: 0 var(--padding);
    max-width: 1200px;
    margin: 0 auto;
  }

  .no-results {
    text-align: center;
    color: var(--color-step-30);
    padding: calc(var(--padding) * 4);
  }
</style>
