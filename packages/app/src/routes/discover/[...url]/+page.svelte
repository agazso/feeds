<script lang="ts">
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import type { Feed, Post } from '@feeds/core'
  import { goto } from '$app/navigation'
  import FeedHeader from '$lib/components/FeedHeader.svelte'
  import PostList from '$lib/components/PostList.svelte'
  import TagSelector from '$lib/components/TagSelector.svelte'
  import { prefix } from '$lib/prefix'
  import { auth } from '$lib/stores/auth.svelte'
  import { buildTagCooccurrence, getSuggestedTags } from '$lib/tags'

  interface Props {
    data: {
      url: string
      availableTags: string[]
      existingFeedUrls: string[]
      feeds: Feed[]
      myfeedPosts: Post[]
    }
  }

  const { data }: Props = $props()

  interface DiscoveredFeed {
    name: string
    url: string
    feedUrl: string
    favicon: string
    itemCount: number
    enrich: boolean
  }

  let url = $state(untrack(() => data.url) || '')
  let loading = $state(false)
  let error = $state<string | null>(null)
  let discoveredFeed = $state<DiscoveredFeed | null>(null)
  let posts = $state<Post[]>([])

  // A subscription list (OPML): many feeds, no posts. Picked from, not previewed.
  let listFeeds = $state<Feed[]>([])
  const picked = new SvelteSet<string>()
  let importTags = $state<string[]>([])
  let importing = $state(false)
  let sourceLabel = $state('')
  let imported = $state<{ added: number; skipped: number } | null>(null)

  const alreadyFollowed = (feedUrl: string) => data.existingFeedUrls.includes(feedUrl)
  const importable = $derived(listFeeds.filter((f) => !alreadyFollowed(f.feedUrl)))
  const pickedCount = $derived(importable.filter((f) => picked.has(f.feedUrl)).length)

  // Add feed mode state
  let addMode = $state(false)
  let selectedTags = $state<string[]>([])
  // Pre-ticked when the feed looks like a link aggregator; you can override it here.
  let enrichFeed = $state(false)
  let saving = $state(false)
  let feedAdded = $state(false)
  let embeddingSuggestions = $state<string[]>([])

  const cooccurrence = $derived(buildTagCooccurrence(data.feeds, data.myfeedPosts))
  const suggestedTags = $derived(
    [...new Set([...embeddingSuggestions, ...getSuggestedTags(selectedTags, cooccurrence)])].slice(
      0,
      5,
    ),
  )

  // Check if the discovered feed already exists
  const feedExists = $derived(
    discoveredFeed ? data.existingFeedUrls.includes(discoveredFeed.feedUrl) || feedAdded : false,
  )

  async function discover() {
    if (!url.trim()) return

    loading = true
    error = null

    // Update browser URL to include the discovered URL
    const encodedUrl = encodeURIComponent(url.trim())
    goto(`${prefix()}/discover/${encodedUrl}`)

    try {
      const response = await fetch(`${prefix()}/api/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        error = responseData.error || 'Failed to discover feed'
        return
      }

      if (responseData.kind === 'list') {
        sourceLabel = url.trim()
        listFeeds = responseData.feeds
        // Everything not already followed starts ticked: importing the lot is the
        // common case, and unticking a few is less work than ticking ninety.
        pickAll(true)
        return
      }

      discoveredFeed = responseData.feed
      posts = responseData.posts
      fetchEmbeddingSuggestions()
    } catch {
      error = 'Failed to discover feed. Please check the URL and try again.'
    } finally {
      loading = false
    }
  }

  function enterAddMode() {
    addMode = true
    selectedTags = []
    enrichFeed = discoveredFeed?.enrich ?? false
  }

  function cancelAddMode() {
    addMode = false
    selectedTags = []
  }

  async function fetchEmbeddingSuggestions() {
    if (!discoveredFeed || !posts.length) return
    const text = [
      discoveredFeed.name,
      ...posts.slice(0, 5).map((p) => p.rssItem?.title || p.text.slice(0, 100)),
    ].join('. ')

    try {
      const res = await fetch(`${prefix()}/api/suggest-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      embeddingSuggestions = data.tags || []
    } catch {
      // Ignore errors, fall back to co-occurrence only
    }
  }

  async function saveFeed() {
    if (!discoveredFeed) return

    saving = true

    try {
      const response = await fetch(`${prefix()}/api/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feed: {
            name: discoveredFeed.name,
            url: discoveredFeed.url,
            feedUrl: discoveredFeed.feedUrl,
            favicon: discoveredFeed.favicon,
            tags: selectedTags,
            enrich: enrichFeed,
          },
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        error = result.error || 'Failed to save feed'
        return
      }

      addMode = false
      selectedTags = []
      feedAdded = true
    } catch {
      error = 'Failed to save feed. Please try again.'
    } finally {
      saving = false
    }
  }

  let fileInput = $state<HTMLInputElement | null>(null)

  /** An OPML file from another reader, which needs no fetching — just parsing. */
  async function openOpmlFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return

    loading = true
    error = null
    try {
      const response = await fetch(`${prefix()}/api/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opml: await file.text() }),
      })
      const responseData = await response.json()
      if (!response.ok) {
        error = responseData.error || 'Could not read that file'
        return
      }
      sourceLabel = file.name
      listFeeds = responseData.feeds
      pickAll(true)
    } catch {
      error = 'Could not read that file. Is it an OPML subscription list?'
    } finally {
      loading = false
      // Cleared so choosing the same file again still fires a change event.
      if (fileInput) fileInput.value = ''
    }
  }

  function togglePicked(feedUrl: string) {
    if (picked.has(feedUrl)) picked.delete(feedUrl)
    else picked.add(feedUrl)
  }

  function pickAll(on: boolean) {
    picked.clear()
    if (on) for (const f of importable) picked.add(f.feedUrl)
  }

  async function importPicked() {
    const feeds = importable
      .filter((f) => picked.has(f.feedUrl))
      .map((f) => ({
        ...f,
        // The list's own tags for this feed, plus whatever was chosen for the import.
        tags: [...new Set([...(f.tags ?? []), ...importTags])],
      }))
    if (!feeds.length) return

    importing = true
    error = null
    try {
      const response = await fetch(`${prefix()}/api/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeds }),
      })
      const result = await response.json()
      if (!response.ok) {
        error = result.error || 'Failed to import feeds'
        return
      }
      imported = { added: result.added, skipped: result.skipped }
    } catch {
      error = 'Failed to import feeds. Please try again.'
    } finally {
      importing = false
    }
  }

  // Auto-discover if URL parameter is provided. Every outcome of discover() has to
  // be represented here: a subscription list leaves discoveredFeed null, so without
  // listFeeds this re-runs on its own result, forever.
  $effect(() => {
    if (data.url && !discoveredFeed && !listFeeds.length && !loading && !error) {
      url = data.url
      discover()
    }
  })

  // Reset state when navigating to /discover without URL param (handles menu navigation)
  $effect(() => {
    if (!data.url) {
      discoveredFeed = null
      posts = []
      error = null
      url = ''
      addMode = false
      selectedTags = []
      enrichFeed = false
      feedAdded = false
      embeddingSuggestions = []
      listFeeds = []
      picked.clear()
      importTags = []
      imported = null
      sourceLabel = ''
    }
  })
</script>

<svelte:head>
  <title>Discover Feed</title>
</svelte:head>

<div class="discover-page">
  {#if listFeeds.length}
    <div class="import-container">
      <div class="import-header">
        <h2>Subscription list</h2>
        <p class="import-subtitle">
          {listFeeds.length} feeds found in
          <span class="import-source">{sourceLabel}</span>. Pick the ones to follow.
        </p>
      </div>

      {#if imported}
        <p class="import-done">
          Added {imported.added}
          {imported.added === 1 ? 'feed' : 'feeds'}{imported.skipped
            ? `, skipped ${imported.skipped} already followed`
            : ''}.
          <a href="{prefix()}/feeds">Go to feeds</a>
        </p>
      {:else if auth.canWrite}
        <div class="import-tags">
          <p class="import-tags-label">Tags for every feed you import</p>
          <TagSelector
            availableTags={data.availableTags}
            bind:selectedTags={importTags}
            suggestedTags={[]}
          />
        </div>

        <div class="import-actions">
          <button type="button" class="link-button" onclick={() => pickAll(true)}>
            Select all
          </button>
          <button type="button" class="link-button" onclick={() => pickAll(false)}>
            Select none
          </button>
          <button
            type="button"
            class="save-button"
            onclick={importPicked}
            disabled={importing || pickedCount === 0}
          >
            {importing ? 'Importing…' : `Import ${pickedCount}`}
          </button>
        </div>
      {/if}

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <ul class="import-list">
        {#each listFeeds as feed (feed.feedUrl)}
          {@const followed = alreadyFollowed(feed.feedUrl)}
          <li class="import-row" class:followed>
            <label>
              <input
                type="checkbox"
                checked={picked.has(feed.feedUrl)}
                disabled={followed || !!imported || !auth.canWrite}
                onchange={() => togglePicked(feed.feedUrl)}
              />
              <span class="import-feed">
                <span class="import-name">{feed.name || feed.feedUrl}</span>
                <span class="import-url">{feed.url || feed.feedUrl}</span>
                {#if feed.tags?.length}
                  <span class="import-feed-tags">
                    {#each feed.tags as tag (tag)}
                      <span class="tag-chip">#{tag}</span>
                    {/each}
                  </span>
                {/if}
              </span>
            </label>
            {#if followed}
              <span class="followed-badge">Following</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {:else if discoveredFeed}
    <div class="feed-container">
      <FeedHeader
        name={discoveredFeed.name}
        url={discoveredFeed.url}
        favicon={discoveredFeed.favicon}
      >
        {#if feedExists}
          <a
            href="{prefix()}/feeds/{encodeURIComponent(discoveredFeed.feedUrl)}"
            class="visit-button">Visit feed</a
          >
        {:else if auth.canWrite}
          <button type="button" class="add-button" onclick={enterAddMode}>Add feed</button>
        {/if}
      </FeedHeader>

      {#if addMode}
        <div class="add-feed-screen">
          <h3>Add "{discoveredFeed.name}" to your feeds</h3>
          <p class="feed-url-info">{discoveredFeed.feedUrl}</p>

          <TagSelector availableTags={data.availableTags} bind:selectedTags {suggestedTags} />

          <label class="enrich-option">
            <input type="checkbox" bind:checked={enrichFeed} />
            <span>
              Show enriched posts
              <small>
                Fetches each linked page for its own title, author and image — for link aggregators,
                whose items all point elsewhere.
              </small>
            </span>
          </label>

          <div class="actions">
            <button type="button" class="save-button" onclick={saveFeed} disabled={saving}>
              {saving ? 'Saving...' : 'Save Feed'}
            </button>
            <button type="button" class="cancel-button" onclick={cancelAddMode}>Cancel</button>
          </div>

          {#if error}
            <p class="error">{error}</p>
          {/if}
        </div>
      {:else}
        <PostList {posts} />
      {/if}
    </div>
  {:else}
    <div class="discover-form">
      <input
        type="url"
        class="url-input"
        placeholder="Enter website URL (e.g., https://news.ycombinator.com/)"
        bind:value={url}
        disabled={loading}
        onkeydown={(e) => e.key === 'Enter' && discover()}
      />
      <button type="button" class="discover-button" disabled={loading || !url} onclick={discover}>
        {loading ? 'Discovering...' : 'Discover Feed'}
      </button>
    </div>

    <p class="opml-hint">
      Coming from another reader?
      <button
        type="button"
        class="link-button"
        disabled={loading}
        onclick={() => fileInput?.click()}
      >
        Import an OPML file
      </button>
    </p>
    <input
      bind:this={fileInput}
      type="file"
      accept=".opml,.xml,application/xml,text/xml,text/x-opml"
      class="visually-hidden"
      onchange={openOpmlFile}
    />

    {#if loading}
      <p class="loading-text">Discovering feed and enriching items...</p>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}
  {/if}
</div>

<style>
  .import-container {
    width: 100%;
    max-width: var(--max-column-width);
    margin: 0 auto;
    padding: var(--padding);
  }

  .import-header h2 {
    margin: 0;
  }

  .import-subtitle {
    color: var(--color-step-30);
    margin: var(--half-padding) 0 var(--padding);
  }

  .import-tags {
    margin-bottom: var(--padding);
  }

  .import-tags-label {
    font-size: 13px;
    color: var(--color-step-30);
    margin: 0 0 var(--half-padding);
  }

  .import-actions {
    display: flex;
    align-items: center;
    gap: var(--half-padding);
    flex-wrap: wrap;
    margin-bottom: var(--padding);
  }

  .import-actions .save-button {
    margin-left: auto;
  }

  /* app.css makes every button a flex box with a min-width and height; a button that
     reads as a link has to opt out of all three or it breaks onto its own line. */
  .link-button {
    display: inline;
    min-width: 0;
    height: auto;
    background: none;
    border: none;
    padding: 0;
    color: var(--color);
    font-size: 14px;
    cursor: pointer;
    text-decoration: underline;
  }

  .import-done {
    padding: var(--padding);
    border: 1px solid var(--color-step-20);
    border-radius: 4px;
    margin-bottom: var(--padding);
  }

  .import-done a {
    color: var(--color);
  }

  .import-source {
    word-break: break-all;
  }

  .import-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .import-row {
    display: flex;
    align-items: center;
    gap: var(--half-padding);
    padding: var(--half-padding) 0;
    border-bottom: 1px solid #88888833;
  }

  .import-row.followed {
    opacity: 0.55;
  }

  .import-row label {
    display: flex;
    align-items: flex-start;
    gap: var(--half-padding);
    flex-grow: 1;
    min-width: 0;
    cursor: pointer;
  }

  .import-row.followed label {
    cursor: default;
  }

  .import-feed {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .import-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .import-url {
    font-size: 13px;
    color: var(--color-step-30);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .import-feed-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .tag-chip {
    padding: 2px 8px;
    font-size: 12px;
    border-radius: 12px;
    background: var(--color-step-20);
    color: var(--color);
  }

  .followed-badge {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--color-step-30);
  }

  .discover-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 60vh;
  }

  .opml-hint {
    width: 100%;
    max-width: var(--max-column-width);
    margin: 0 var(--padding);
    text-align: center;
    color: var(--color-step-30);
    font-size: 14px;
  }

  /* Reachable by keyboard and screen readers; the link above is what you click. */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .discover-form {
    display: flex;
    flex-direction: row;
    justify-content: stretch;
    align-items: center;
    width: 100%;
    max-width: var(--max-column-width);
    border-color: #88888888;
    border-width: 1px;
    border-radius: 4px;
    border-style: solid;
    padding: var(--padding);
    padding-right: var(--half-padding);
    background-color: var(--background-color);
    color: var(--color);
    height: 48px;
    gap: var(--half-padding);
    margin: var(--padding);
  }

  .url-input {
    appearance: none;
    display: block;
    flex-grow: 1;
    min-width: 0;
    font-size: 16px;
    border: 0;
    padding: 0;
    background-color: var(--background-color);
    color: var(--color);
  }

  .url-input:disabled {
    opacity: 0.6;
  }

  .discover-button {
    padding: var(--half-padding) var(--padding);
    min-width: 120px;
    font-size: 14px;
  }

  .discover-button:disabled {
    opacity: 0.6;
  }

  .loading-text {
    color: #888;
    margin-top: var(--padding);
    text-align: center;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .enrich-option {
    display: flex;
    align-items: flex-start;
    gap: var(--half-padding);
    max-width: var(--max-column-width);
    margin: var(--padding) 0;
    cursor: pointer;
    text-align: left;
  }

  .enrich-option small {
    display: block;
    color: #888;
  }

  .error {
    color: #e74c3c;
    margin-top: var(--padding);
    text-align: center;
  }

  .feed-container {
    width: 100%;
  }

  .add-button,
  .visit-button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
  }

  .visit-button {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    background-color: inherit;
    color: #fff8;
    border: 1px solid #fff8;
    border-radius: 4px;
  }

  .visit-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .add-feed-screen {
    max-width: var(--max-column-width);
    margin: 0 auto;
    padding: var(--padding);
  }

  .add-feed-screen h3 {
    margin: 0 0 var(--half-padding) 0;
    font-size: 18px;
  }

  .feed-url-info {
    color: #888;
    font-size: 12px;
    margin: 0 0 var(--padding) 0;
    word-break: break-all;
  }

  .actions {
    display: flex;
    gap: var(--half-padding);
    margin-top: var(--padding);
  }

  .save-button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
  }

  .save-button:disabled {
    opacity: 0.6;
  }

  .cancel-button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    background: transparent;
    border: 1px solid #88888888;
  }
</style>
