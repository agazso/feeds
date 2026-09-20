<script lang="ts">
  import Dropdown from './Dropdown.svelte'

  export interface MenuItem {
    label: string
    href?: string
    onclick?: () => void
  }

  interface Props {
    items: MenuItem[]
  }

  const { items }: Props = $props()
</script>

<div class="post-card-menu">
  <Dropdown>
    {#snippet trigger()}
      <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" aria-label="Menu">
        <circle cx="16" cy="8" r="2" />
        <circle cx="16" cy="16" r="2" />
        <circle cx="16" cy="24" r="2" />
      </svg>
    {/snippet}

    <div class="menu-dropdown">
      {#each items as item}
        {#if item.href}
          <a href={item.href} class="menu-item" onclick={(e) => e.stopPropagation()}>
            {item.label}
          </a>
        {:else}
          <button
            type="button"
            class="menu-item"
            onclick={(e) => {
              e.stopPropagation()
              item.onclick?.()
            }}
          >
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  </Dropdown>
</div>

<style>
  .post-card-menu :global(.dropdown-trigger) {
    width: 32px;
    height: 32px;
    color: #888;
  }

  .post-card-menu :global(.dropdown-trigger:hover),
  .post-card-menu :global(.dropdown-trigger.active) {
    background-color: #88888844;
    color: var(--color);
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
    font: inherit;
    font-size: 14px;
    text-decoration: none;
    min-width: unset;
  }

  .menu-item:hover {
    background-color: #88888844;
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
</style>
