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
        <a href="/share" class="menu-item">Share</a>
      </div>
    </Dropdown>
  </div>
  <div class="spacer"></div>
  <div class="settings-dropdown">
    <Dropdown align="right">
      {#snippet trigger()}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <rect x="2" y="4" width="16" height="2" rx="1"/>
          <rect x="2" y="9" width="16" height="2" rx="1"/>
          <rect x="2" y="14" width="16" height="2" rx="1"/>
        </svg>
      {/snippet}

      <div class="menu-dropdown">
        <button class="menu-item" onclick={() => preferences.toggleLayout()}>
          {#if preferences.layout === 'three-column'}
            <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
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
            <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
              <rect x="14" y="2" width="4" height="28" rx="1"/>
            </svg>
          {/if}
          <span>Layout: {preferences.layout === 'three-column' ? 'Grid' : 'Single'}</span>
        </button>
        <button class="menu-item" onclick={() => preferences.toggleTheme()}>
          <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
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
          <span>Theme: {preferences.theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </Dropdown>
  </div>
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
    display: flex;
    align-items: center;
    gap: var(--half-padding);
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

  .settings-dropdown {
    padding: var(--half-padding);
  }

  .settings-dropdown :global(.dropdown-trigger) {
    padding: var(--half-padding);
    color: #fff8;
    fill: #fff8;
  }

  .settings-dropdown :global(.dropdown-trigger:hover),
  .settings-dropdown :global(.dropdown-trigger.active) {
    background-color: #ffffff22;
  }

  .menu-item svg {
    flex-shrink: 0;
  }
</style>
