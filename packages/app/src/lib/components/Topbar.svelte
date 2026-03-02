<script lang="ts">
import { preferences } from '$lib/stores/preferences.svelte'

function handleReload() {
  window.location.reload()
}
</script>

<header class="topbar">
  <button class="logo-btn" onclick={handleReload} aria-label="Reload">
    <img src="/icon-white-transparent.png" alt="Feeds logo" class="logo" />
  </button>
  <a href="/tags" class="nav-link">Tags</a>
  <div class="spacer"></div>
  <button class="icon-btn" onclick={() => preferences.toggleLayout()} aria-label="Toggle layout">
    {#if preferences.layout === 'three-column'}
      <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
        <rect x="2" y="2" width="8" height="8" rx="1"/>
        <rect x="12" y="2" width="8" height="8" rx="1"/>
        <rect x="22" y="2" width="8" height="8" rx="1"/>
        <rect x="2" y="12" width="8" height="8" rx="1"/>
        <rect x="12" y="12" width="8" height="8" rx="1"/>
        <rect x="22" y="12" width="8" height="8" rx="1"/>
        <rect x="2" y="22" width="8" height="8" rx="1"/>
        <rect x="12" y="22" width="8" height="8" rx="1"/>
        <rect x="22" y="22" width="8" height="8" rx="1"/>
      </svg>
    {:else}
      <span style="font-size: 24px;">&#x2759;</span>
    {/if}
  </button>
  <button class="icon-btn" onclick={() => preferences.toggleTheme()} aria-label="Toggle theme">
    <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
      <rect x="15" y="2" width="2" height="3"/>
      <rect x="27" y="15" width="3" height="2"/>
      <rect x="15" y="27" width="2" height="3"/>
      <rect x="2" y="15" width="3" height="2"/>
      <rect x="6.22" y="5.73" width="2" height="3" transform="rotate(-45 7.22 7.23)"/>
      <rect x="23.27" y="6.23" width="3" height="2" transform="rotate(-45 24.77 7.23)"/>
      <rect x="23.77" y="23.27" width="2" height="3" transform="rotate(-45 24.77 24.77)"/>
      <rect x="5.47" y="23.72" width="3" height="2" transform="rotate(-45 6.97 24.72)"/>
      <path d="M16,8a8,8,0,1,0,8,8A8,8,0,0,0,16,8Zm0,14a6,6,0,0,1,0-12Z"/>
    </svg>
  </button>
</header>

<style>
  .topbar {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    height: var(--header-height);
    background-color: var(--color-step-10);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    box-shadow: none;
    cursor: pointer;
    padding: var(--half-padding);
    margin: 0;
    min-width: unset;
  }

  .logo-btn:hover {
    background: transparent;
  }

  .logo {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }

  .nav-link {
    color: #fff8;
    text-decoration: none;
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
  }

  .nav-link:hover {
    color: #fff;
  }

  .spacer {
    flex-grow: 1;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #fff8;
    fill: #fff8;
  }
</style>
