<script lang="ts">
import { page } from '$app/state'
import type { Feed } from '@feeds/core'

// Without `feeds`: this page's own `.rss` / `.json` twins, so a reader finds them
// without knowing the suffix convention. With `feeds`: the source feeds the page
// lists — a followed feed already publishes its own, and its URL may itself end in
// `.rss` (Reddit), so advertise that instead of a twin we would have to serve.
const { feeds }: { feeds?: Feed[] } = $props()
</script>

<svelte:head>
  {#if feeds}
    {#each feeds as feed (feed.feedUrl)}
      <link rel="alternate" type="application/rss+xml" title={feed.name} href={feed.feedUrl} />
    {/each}
  {:else}
    <link rel="alternate" type="application/rss+xml" title="RSS" href="{page.url.pathname}.rss" />
    <link
      rel="alternate"
      type="application/feed+json"
      title="JSON Feed"
      href="{page.url.pathname}.json"
    />
  {/if}
</svelte:head>
