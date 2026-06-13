<script lang="ts">
import { preferences } from '$lib/stores/preferences.svelte'
import { auth } from '$lib/stores/auth.svelte'
import { Grid, List, Asleep, Light, User, Locked, Unlocked } from 'carbon-icons-svelte'
import Dropdown from './Dropdown.svelte'

const authLabel = $derived(
  !auth.enabled ? 'Auth disabled' : auth.authenticated ? 'Authenticated' : 'Not authenticated',
)
</script>

<header class="topbar">
  <div class="nav-dropdown">
    <Dropdown align="left">
      {#snippet trigger()}
        <img src="/icon-white-transparent.png" alt="Feeds logo" class="logo" />
      {/snippet}

      <div class="menu-dropdown">
        <a href="/" class="menu-item">Myfeed</a>
        <a href="/all-posts" class="menu-item">All Posts</a>
        <a href="/feeds" class="menu-item">Feeds</a>
        <a href="/tags" class="menu-item">Tags</a>
        {#if auth.canWrite}
          <a href="/discover" class="menu-item">Discover</a>
          <a href="/share" class="menu-item">Share</a>
        {/if}
      </div>
    </Dropdown>
  </div>
  <div class="spacer"></div>
  <div class="settings-dropdown">
    <Dropdown align="right">
      {#snippet trigger()}
        <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
          <path d="M27,16.76c0-.25,0-.5,0-.76s0-.51,0-.77l1.92-1.68A2,2,0,0,0,29.3,11L26.94,7a2,2,0,0,0-1.73-1,2,2,0,0,0-.64.1l-2.43.82a11.35,11.35,0,0,0-1.31-.75l-.51-2.52a2,2,0,0,0-2-1.61H13.64a2,2,0,0,0-2,1.61l-.51,2.52a11.48,11.48,0,0,0-1.32.75L7.43,6.06A2,2,0,0,0,6.79,6,2,2,0,0,0,5.06,7L2.7,11a2,2,0,0,0,.41,2.51L5,15.24c0,.25,0,.5,0,.76s0,.51,0,.77L3.11,18.45A2,2,0,0,0,2.7,21L5.06,25a2,2,0,0,0,1.73,1,2,2,0,0,0,.64-.1l2.43-.82a11.35,11.35,0,0,0,1.31.75l.51,2.52a2,2,0,0,0,2,1.61h4.72a2,2,0,0,0,2-1.61l.51-2.52a11.48,11.48,0,0,0,1.32-.75l2.42.82a2,2,0,0,0,.64.1,2,2,0,0,0,1.73-1L29.3,21a2,2,0,0,0-.41-2.51ZM25.21,24l-3.43-1.16a8.86,8.86,0,0,1-2.71,1.57L18.36,28H13.64l-.71-3.55a9.36,9.36,0,0,1-2.7-1.57L6.79,24,4.43,20l2.72-2.4a8.9,8.9,0,0,1,0-3.13L4.43,12,6.79,8l3.43,1.16a8.86,8.86,0,0,1,2.71-1.57L13.64,4h4.72l.71,3.55a9.36,9.36,0,0,1,2.7,1.57L25.21,8,27.57,12l-2.72,2.4a8.9,8.9,0,0,1,0,3.13L27.57,20Z"/>
          <path d="M16,22a6,6,0,1,1,6-6A5.94,5.94,0,0,1,16,22Zm0-10a3.91,3.91,0,0,0-4,4,3.91,3.91,0,0,0,4,4,3.91,3.91,0,0,0,4-4A3.91,3.91,0,0,0,16,12Z"/>
        </svg>
      {/snippet}

      <div class="menu-dropdown">
        <button class="menu-item layout-toggle" onclick={() => preferences.toggleLayout()}>
          {#if preferences.layout === 'three-column'}
            <Grid size={16} />
          {:else}
            <List size={16} />
          {/if}
          <span>Layout: {preferences.layout === 'three-column' ? 'Grid' : 'Single'}</span>
        </button>
        <button class="menu-item" onclick={() => preferences.toggleTheme()}>
          {#if preferences.theme === 'dark'}
            <Asleep size={16} />
          {:else}
            <Light size={16} />
          {/if}
          <span>Theme: {preferences.theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
        <a href="/auth" class="menu-item auth-item">
          {#if !auth.enabled}
            <Unlocked size={16} />
          {:else if auth.authenticated}
            <User size={16} />
          {:else}
            <Locked size={16} />
          {/if}
          <span>{authLabel}</span>
        </a>
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
    position: fixed;
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
    min-width: 180px;
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

  /* Anchors don't get the global button { justify-content: center }, so center
     this one explicitly to match the Layout/Theme buttons in the settings dropdown. */
  .auth-item {
    justify-content: center;
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

  .menu-item :global(svg) {
    flex-shrink: 0;
  }

  /* Touch-friendly styles when in drawer mode */
  :global(.drawer-content) .menu-dropdown {
    display: flex;
    flex-direction: column;
    gap: var(--half-padding);
    border: none;
    box-shadow: none;
    padding: 0;
  }

  :global(.drawer-content) .menu-item {
    height: auto;
    padding: var(--padding);
    font-size: 18px;
    line-height: 1.4;
    border-radius: 8px;
  }

  /* Hide layout toggle on mobile since layout is forced to single-column via CSS */
  :global(.drawer-content) .layout-toggle {
    display: none;
  }
</style>
