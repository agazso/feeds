<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  label: string // aria-label for the trigger
  icon?: string // trigger glyph, default ⓘ
  children: Snippet // popover content
}

let { label, icon = 'ⓘ', children }: Props = $props()

let open = $state(false)
</script>

<div class="tooltip-wrap">
  <button
    type="button"
    class="tooltip-trigger"
    aria-label={label}
    aria-expanded={open}
    onclick={() => (open = !open)}
    onmouseenter={() => (open = true)}
    onmouseleave={() => (open = false)}
    onblur={() => (open = false)}
  >{icon}</button>
  {#if open}
    <div class="tooltip-popover" role="tooltip">{@render children()}</div>
  {/if}
</div>

<style>
  /* ponytail: no position here, so the popover anchors to the nearest
     positioned ancestor (the .search-form) and can span the input width */
  .tooltip-wrap {
    display: flex;
  }

  /* mirrors .search-reset so × and ⓘ look identical */
  .tooltip-trigger {
    color: #888;
    margin: 0;
    padding: var(--half-padding);
    min-width: unset;
    height: unset;
    border: 0;
    box-shadow: unset;
    font-size: 16px;
  }

  .tooltip-popover {
    position: absolute;
    top: 100%;
    left: var(--padding);
    right: var(--padding);
    z-index: 10;
    margin-top: var(--half-padding);
    padding: var(--padding);
    text-align: left;
    font-size: 14px;
    background-color: var(--background-color);
    color: var(--color);
    border: 1px solid #88888888;
    border-radius: 4px;
  }

  .tooltip-popover :global(ul) {
    margin: var(--half-padding) 0 0;
    padding-left: 1.2em;
  }
</style>
