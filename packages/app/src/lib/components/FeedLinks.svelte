<script lang="ts">
// Advertise this page's `.rss` / `.json` twins so a reader (or the browser) finds
// them without the user knowing the suffix convention.
import { page } from '$app/state'
</script>

<svelte:head>
  <link rel="alternate" type="application/rss+xml" title="RSS" href="{page.url.pathname}.rss" />
  <link
    rel="alternate"
    type="application/feed+json"
    title="JSON Feed"
    href="{page.url.pathname}.json"
  />
</svelte:head>
