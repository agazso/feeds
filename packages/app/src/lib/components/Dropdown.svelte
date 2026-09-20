<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    trigger: Snippet
    children: Snippet
    align?: 'left' | 'right'
  }

  const { trigger, children, align = 'right' }: Props = $props()

  const menuId = Math.random().toString(36).substring(2)
  let open = $state(false)
  let containerElement: HTMLDivElement | undefined = $state()
  let isMobile = $state(false)

  // Detect mobile viewport
  $effect(() => {
    const mq = window.matchMedia('(max-width: 500px)')
    isMobile = mq.matches
    function handleChange(e: MediaQueryListEvent) {
      isMobile = e.matches
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  })

  function toggle(e: MouseEvent) {
    e.stopPropagation()
    if (!open) {
      window.dispatchEvent(new CustomEvent('close-dropdowns', { detail: { except: menuId } }))
    }
    open = !open
  }

  function closeDrawer() {
    open = false
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
    return () =>
      window.removeEventListener('close-dropdowns', handleCloseDropdowns as EventListener)
  })

  // Handle click outside (desktop only)
  $effect(() => {
    if (open && !isMobile) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  })

  // Handle escape key
  $effect(() => {
    if (open) {
      function handleEscape(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          open = false
        }
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  })
</script>

<div class="dropdown" bind:this={containerElement}>
  <button type="button" class="dropdown-trigger" class:active={open} onclick={toggle}>
    {@render trigger()}
  </button>
  {#if open}
    {#if isMobile}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="drawer-overlay"
        onclick={(e) => {
          e.stopPropagation()
          closeDrawer()
        }}
        onkeydown={(e) => e.key === 'Escape' && closeDrawer()}
      ></div>
      <div
        class="drawer-content"
        onclick={closeDrawer}
        onkeydown={(e) => e.key === 'Escape' && closeDrawer()}
        role="menu"
        tabindex="-1"
      >
        {@render children()}
      </div>
    {:else}
      <div
        class="dropdown-content"
        class:align-left={align === 'left'}
        onclick={() => (open = false)}
        onkeydown={(e) => e.key === 'Escape' && (open = false)}
        role="menu"
        tabindex="-1"
      >
        {@render children()}
      </div>
    {/if}
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
    animation: popover-in 0.15s ease-out;
    transform-origin: top right;
  }

  .dropdown-content.align-left {
    left: 0;
    right: auto;
    transform-origin: top left;
  }

  @keyframes popover-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Mobile drawer styles */
  .drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }

  .drawer-content {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--background-color);
    border-top: 1px solid #88888888;
    border-radius: 12px 12px 0 0;
    padding: var(--padding);
    padding-bottom: calc(var(--padding) + env(safe-area-inset-bottom));
    z-index: 1000;
    animation: slide-up 0.2s ease-out;
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
</style>
