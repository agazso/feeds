<script lang="ts">
import type { PageData } from './$types'
import CopyLink from '$lib/components/CopyLink.svelte'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
  <title>Invite @{data.name}</title>
</svelte:head>

<div class="invite-page">
  <h2>@{data.name} is ready</h2>
  <p class="explanation">
    Send this link. It signs them in on their device and lets them write under
    <code>/@{data.name}</code>. Anyone holding it gets that access, so share it directly.
  </p>

  <CopyLink url={data.inviteUrl} />

  <p class="explanation">
    <a href="/@{data.name}">Open their feed</a> · <a href="/invite">Invite someone else</a>
  </p>
</div>

<style>
  .invite-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-height: 60vh;
    padding: var(--padding);
    padding-top: calc(var(--padding) * 4);
    gap: var(--padding);
  }

  h2 {
    margin: 0;
    font-size: 24px;
  }

  .explanation {
    color: #888;
    margin: 0;
    max-width: var(--max-column-width);
  }

  code {
    background: #88888822;
    padding: 0 4px;
    border-radius: 4px;
    font-size: 0.9em;
  }

</style>
