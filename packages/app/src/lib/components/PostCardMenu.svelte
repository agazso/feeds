<script lang="ts">
export interface MenuItem {
  label: string
  href?: string
  onclick?: () => void
}

interface Props {
  items: MenuItem[]
}

let { items }: Props = $props()

let open = $state(false)
let menuElement: HTMLDivElement | undefined = $state()

function toggle(e: MouseEvent) {
  e.stopPropagation()
  open = !open
}

function handleClickOutside(e: MouseEvent) {
  if (menuElement && !menuElement.contains(e.target as Node)) {
    open = false
  }
}

function handleItemClick(e: MouseEvent, item: MenuItem) {
  e.stopPropagation()
  if (item.onclick) {
    item.onclick()
  }
  open = false
}

$effect(() => {
  if (open) {
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<div class="menu-container" bind:this={menuElement}>
  <button type="button" class="menu-trigger" class:active={open} onclick={toggle} aria-label="Menu">
    <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
      <circle cx="16" cy="8" r="2"/>
      <circle cx="16" cy="16" r="2"/>
      <circle cx="16" cy="24" r="2"/>
    </svg>
  </button>

  {#if open}
    <div class="menu-dropdown">
      {#each items as item}
        {#if item.href}
          <a
            href={item.href}
            class="menu-item"
            onclick={(e) => { e.stopPropagation(); open = false; }}
          >
            {item.label}
          </a>
        {:else}
          <button
            type="button"
            class="menu-item"
            onclick={(e) => handleItemClick(e, item)}
          >
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu-container {
    position: relative;
  }

  .menu-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    box-shadow: none;
    cursor: pointer;
    color: #888;
    min-width: unset;
  }

  .menu-trigger:hover,
  .menu-trigger.active {
    background-color: #88888844;
    color: var(--color);
  }

  .menu-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 150px;
    background-color: var(--background-color);
    border: 1px solid #88888888;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 100;
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
</style>
