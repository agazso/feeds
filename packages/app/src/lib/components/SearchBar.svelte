<script lang="ts">
  import { debounce } from '$lib/search'
  import Tooltip from './Tooltip.svelte'

  interface Props {
    value?: string
    onchange?: (value: string) => void
  }

  let { value = $bindable(''), onchange }: Props = $props()

  let inputRef: HTMLInputElement

  const debouncedChange = debounce((val: string) => {
    onchange?.(val)
  }, 300)

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    value = target.value
    debouncedChange(value)
  }

  function handleReset() {
    value = ''
    onchange?.('')
  }

  function handleSubmit(e: Event) {
    e.preventDefault()
    inputRef?.blur()
  }
</script>

<form class="search-form" onsubmit={handleSubmit}>
  <input
    bind:this={inputRef}
    type="search"
    class="searchbar"
    placeholder="Search or filter..."
    {value}
    oninput={handleInput}
  />
  {#if value}
    <button type="button" class="search-reset" onclick={handleReset} aria-label="Clear search"
      >&times;</button
    >
  {:else}
    <Tooltip label="Search help">
      Search or filter posts by keyword, author, or #tag.
      <ul>
        <li>Space-separate words to narrow results</li>
        <li><code>#tag</code> — match a tag</li>
        <li>
          <code>-word</code> — exclude posts containing <em>word</em> (e.g. <code>-query</code>)
        </li>
      </ul>
    </Tooltip>
  {/if}
</form>

<style>
  .search-form {
    position: relative;
    display: flex;
    flex-direction: row;
    justify-content: stretch;
    align-items: center;
    margin: var(--padding) calc((100vw - var(--max-column-width)) / 2 + var(--padding));
    border-color: #88888888;
    border-width: 1px;
    border-radius: 4px;
    border-style: solid;
    padding: var(--padding);
    padding-right: var(--half-padding);
    background-color: var(--background-color);
    color: var(--color);
    height: 40px;
  }

  .searchbar {
    appearance: none;
    display: flex;
    flex-grow: 1;
    font-size: 16px;
    border: 0;
    padding: 0;
    background-color: var(--background-color);
    color: var(--color);
  }

  .search-reset {
    color: #888;
    margin: 0;
    padding: var(--half-padding);
    min-width: unset;
    height: unset;
    border: 0;
    box-shadow: unset;
    font-size: 16px;
  }

  @media screen and (max-width: 500px) {
    .search-form {
      margin: var(--padding);
    }
  }
</style>
