<script lang="ts">
interface Props {
  availableTags: string[]
  selectedTags?: string[]
  onchange?: (tags: string[]) => void
}

let { availableTags, selectedTags = $bindable([]), onchange }: Props = $props()
let newTag = $state('')

function toggleTag(tag: string) {
  if (selectedTags.includes(tag)) {
    selectedTags = selectedTags.filter(t => t !== tag)
  } else {
    selectedTags = [...selectedTags, tag]
  }
  onchange?.(selectedTags)
}

function addNewTag() {
  const tag = newTag.trim().toLowerCase()
  if (tag && !selectedTags.includes(tag)) {
    selectedTags = [...selectedTags, tag]
    onchange?.(selectedTags)
  }
  newTag = ''
}
</script>

<div class="tag-selector">
  <div class="tags-list">
    {#each availableTags as tag}
      <button
        type="button"
        class="tag-chip"
        class:selected={selectedTags.includes(tag)}
        onclick={() => toggleTag(tag)}
      >
        #{tag}
      </button>
    {/each}
  </div>

  <div class="new-tag">
    <input
      type="text"
      placeholder="Add new tag..."
      bind:value={newTag}
      onkeydown={(e) => e.key === 'Enter' && addNewTag()}
    />
    <button type="button" onclick={addNewTag}>Add</button>
  </div>
</div>

<style>
  .tag-selector {
    display: flex;
    flex-direction: column;
    gap: var(--padding);
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--half-padding);
  }

  .tag-chip {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    border-radius: 16px;
    background: transparent;
    border: 1px solid #88888888;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tag-chip:hover {
    border-color: var(--accent-color);
  }

  .tag-chip.selected {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .new-tag {
    display: flex;
    gap: var(--half-padding);
  }

  .new-tag input {
    flex: 1;
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    border: 1px solid #88888888;
    border-radius: 4px;
    background-color: var(--background-color);
    color: var(--color);
  }

  .new-tag button {
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
  }
</style>
