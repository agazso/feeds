<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    trigger: Snippet
    children: Snippet
    align?: 'left' | 'right'
  }

  let { trigger, children, align = 'right' }: Props = $props()

  const menuId = Math.random().toString(36).substring(2)
  let open = $state(false)
  let containerElement: HTMLDivElement | undefined = $state()

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    if (!open) {
      window.dispatchEvent(new CustomEvent('close-dropdowns', { detail: { except: menuId } }))
    }
    open = !open
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerElement && !containerElement.contains(e.target as Node)) {
      open = false
    }
  }

  // Listen for close events from other dropdowns
  $effect(() => {
    function handleCloseDropdowns(e: CustomEvent<{ except: string }>) {
      if (e.detail.except !== menuId) {
        open = false
      }
    }
    window.addEventListener('close-dropdowns', handleCloseDropdowns as EventListener)
    return () => window.removeEventListener('close-dropdowns', handleCloseDropdowns as EventListener)
  })

  // Handle click outside
  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  })
</script>

<div class="dropdown" bind:this={containerElement}>
  <button type="button" class="dropdown-trigger" class:active={open} onclick={toggle}>
    {@render trigger()}
  </button>
  {#if open}
    <div class="dropdown-content" class:align-left={align === 'left'} onclick={() => (open = false)} onkeydown={(e) => e.key === 'Escape' && (open = false)} role="menu" tabindex="-1">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .dropdown {
    position: relative;
  }

  .dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    box-shadow: none;
    cursor: pointer;
    min-width: unset;
  }

  .dropdown-content {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    z-index: 100;
  }

  .dropdown-content.align-left {
    left: 0;
    right: auto;
  }
</style>
