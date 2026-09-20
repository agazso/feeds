<script lang="ts">
import { page } from '$app/state'
import type { Feed } from '@feeds/core'

// Without `feeds`: this page's own feed twins, so a reader finds them without
// knowing the convention. With `feeds`: the source feeds the page lists — a followed
// feed already publishes its own, and its URL may itself end in `.rss` (Reddit), so
// advertise that instead of a twin we would have to serve.
//
// `sep` is the separator before the format. `.` for pages whose path has no dots;
// `/` for a feed page, whose path is a URL full of them (see routes/feeds/syndicate.ts).
const { feeds, sep = '.' }: { feeds?: Feed[]; sep?: string } = $props()
</script>

<svelte:head>
  {#if feeds}
    {#each feeds as feed (feed.feedUrl)}
      <link rel="alternate" type="application/rss+xml" title={feed.name} href={feed.feedUrl} />
    {/each}
  {:else}
    <link
      rel="alternate"
      type="application/rss+xml"
      title="RSS"
      href="{page.url.pathname}{sep}rss"
    />
    <link
      rel="alternate"
      type="application/feed+json"
      title="JSON Feed"
      href="{page.url.pathname}{sep}json"
    />
  {/if}
</svelte:head>
