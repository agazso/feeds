<script lang="ts">
  import type { Feed } from '@feeds/core'
  import { page } from '$app/state'

  // Three ways to advertise a feed, one per page shape:
  // - `feeds`: the source feeds a page lists. A followed feed already publishes its
  //   own, and its URL may itself end in `.rss` (Reddit), so point at that rather than
  //   a twin we would have to serve.
  // - `rss`/`json`: given explicitly, for a page whose feed URL is not its own path
  //   plus an extension — a feed page, served from `/feeds.rss/<url>`.
  // - neither: this page's own `.rss` / `.json` twins.
  const { feeds, rss, json }: { feeds?: Feed[]; rss?: string; json?: string } = $props()

  const rssHref = $derived(rss ?? `${page.url.pathname}.rss`)
  const jsonHref = $derived(json ?? `${page.url.pathname}.json`)
</script>

<svelte:head>
  {#if feeds}
    {#each feeds as feed (feed.feedUrl)}
      <link rel="alternate" type="application/rss+xml" title={feed.name} href={feed.feedUrl} />
    {/each}
  {:else}
    <link rel="alternate" type="application/rss+xml" title="RSS" href={rssHref} />
    <link rel="alternate" type="application/feed+json" title="JSON Feed" href={jsonHref} />
  {/if}
</svelte:head>
