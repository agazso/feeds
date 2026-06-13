<script lang="ts">
import '../app.css'
import type { LayoutData } from './$types'
import { preferences } from '$lib/stores/preferences.svelte'
import { auth } from '$lib/stores/auth.svelte'
import { onMount, untrack } from 'svelte'
import { navigating } from '$app/stores'
import Topbar from '$lib/components/Topbar.svelte'
import Loader from '$lib/components/Loader.svelte'

let { data, children }: { data: LayoutData; children: any } = $props()

// Initialize preferences from server-side cookies (one-time, not reactive)
untrack(() => preferences.init(data.theme, data.layout))
// Initialize auth state from server (hydrated during SSR, no flash)
untrack(() => auth.init(data.authEnabled, data.authenticated))

onMount(() => {
  // Apply theme and layout to document on mount
  document.documentElement.dataset.theme = preferences.theme
  document.documentElement.dataset.layout = preferences.layout
})
</script>

<Topbar />

{#if $navigating}
  <div class="loading-overlay">
    <Loader dimension="large" />
  </div>
{/if}

<main>
  {@render children()}
</main>

<style>
  main {
    margin-top: var(--header-height);
    height: calc(100vh - var(--header-height));
    overflow-y: auto;
  }

  @media (max-width: 500px) {
    main {
      padding-bottom: calc(var(--padding) * 8);
    }
  }

  .loading-overlay {
    position: fixed;
    top: var(--header-height);
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
</style>
