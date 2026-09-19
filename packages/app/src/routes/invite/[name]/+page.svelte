<script lang="ts">
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

let copied = $state(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(data.inviteUrl)
    copied = true
    setTimeout(() => (copied = false), 2000)
  } catch {
    // Clipboard blocked (insecure origin, denied permission) — the link is on screen.
  }
}
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

  <div class="link-row">
    <input class="link" readonly value={data.inviteUrl} onfocus={(e) => e.currentTarget.select()} />
    <button type="button" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
  </div>

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

  .link-row {
    display: flex;
    gap: var(--half-padding);
    width: 100%;
    max-width: 520px;
    margin-top: var(--padding);
  }

  .link {
    flex: 1;
    min-width: 0;
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    border: 1px solid #88888888;
    border-radius: 4px;
    background: var(--background-color);
    color: var(--color);
  }

  .link-row button {
    padding: var(--half-padding) var(--padding);
    font-size: 16px;
    cursor: pointer;
  }
</style>
