<script lang="ts">
  import { Close } from 'carbon-icons-svelte'

  interface Props {
    tag: string
    onremove?: () => void
  }

  const { tag, onremove }: Props = $props()
</script>

<span class="tag-chip">
  #{tag}
  {#if onremove}
    <button type="button" class="remove-btn" onclick={onremove}>
      <Close size={16} />
    </button>
  {/if}
</span>

<style>
  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: var(--half-padding);
    background-color: #88888866;
    border-radius: 4px;
    font-size: 14px;
    color: var(--color);
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color);
    opacity: 0.7;
    transition: opacity 0.15s ease;
    height: auto;
    min-width: 0;
  }

  .remove-btn:hover {
    opacity: 1;
  }

  .remove-btn:hover :global(svg) {
    color: var(--color-step-50);
  }
</style>
