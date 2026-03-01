<script lang="ts">
import '../app.css'
import type { LayoutData } from './$types'
import { preferences } from '$lib/stores/preferences.svelte'
import { onMount } from 'svelte'
import Topbar from '$lib/components/Topbar.svelte'
import BackToTop from '$lib/components/BackToTop.svelte'

let { data, children }: { data: LayoutData; children: any } = $props()

// Initialize preferences from server-side cookies
preferences.init(data.theme, data.layout)

onMount(() => {
  // Apply theme and layout to document on mount
  document.documentElement.dataset.theme = preferences.theme
  document.documentElement.dataset.layout = preferences.layout
})
</script>

<Topbar />
<main>
  {@render children()}
</main>
<BackToTop />

<style>
  main {
    min-height: calc(100vh - var(--header-height));
  }
</style>
