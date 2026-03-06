<script lang="ts">
import { preferences } from '$lib/stores/preferences.svelte'
import Dropdown from './Dropdown.svelte'
</script>

<header class="topbar">
  <div class="nav-dropdown">
    <Dropdown align="left">
      {#snippet trigger()}
        <img src="/icon-white-transparent.png" alt="Feeds logo" class="logo" />
      {/snippet}

      <div class="menu-dropdown">
        <a href="/" class="menu-item">Home</a>
        <a href="/tags" class="menu-item">Tags</a>
        <a href="/discover" class="menu-item">Discover</a>
        <a href="/myfeed" class="menu-item">Myfeed</a>
      </div>
    </Dropdown>
  </div>
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

  .nav-dropdown {
    padding: var(--half-padding);
  }

  .nav-dropdown :global(.dropdown-trigger) {
    padding: 0;
  }

  .nav-dropdown :global(.dropdown-trigger:hover),
  .nav-dropdown :global(.dropdown-trigger.active) {
    background-color: transparent;
  }

  .logo {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }

  .menu-dropdown {
    min-width: 150px;
    background-color: var(--background-color);
    border: 1px solid #88888888;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    padding: var(--padding);
  }

  .menu-item {
    display: block;
    width: 100%;
    margin: 0;
    padding: var(--half-padding) var(--padding);
    text-align: left;
    background: transparent;
    border: none;
    box-shadow: none;
    color: var(--color);
    cursor: pointer;
    font-size: 14px;
    text-decoration: none;
    min-width: unset;
  }

  .menu-item:hover {
    background-color: #88888844;
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
