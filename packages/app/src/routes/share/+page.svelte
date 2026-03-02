<script lang="ts">
import type { ActionData } from './$types'
import { enhance } from '$app/forms'

let { form }: { form: ActionData } = $props()

let loading = $state(false)
let url = $state('')
</script>

<svelte:head>
  <title>Share</title>
</svelte:head>

<div class="share-page">
  {#if form?.success}
    <div class="success-container">
      <div class="success-icon">
        {#if form.post?.icon}
          <img src={form.post.icon} alt="" class="site-icon" />
        {:else}
          <span class="checkmark">&#10003;</span>
        {/if}
      </div>
      <h2>Shared!</h2>
      <p class="post-title">{form.post?.title}</p>
      <a href="/myfeed" class="goto-button">Go to My Feed</a>
    </div>
  {:else}
    <form
      method="POST"
      action="?/share"
      class="share-form"
      use:enhance={() => {
        loading = true
        return async ({ update }) => {
          loading = false
          await update()
        }
      }}
    >
      <input
        type="url"
        name="url"
        class="url-input"
        placeholder="Paste URL to share..."
        bind:value={url}
        required
        disabled={loading}
      />
      <button type="submit" class="share-button" disabled={loading || !url}>
        {loading ? 'Sharing...' : 'Share'}
      </button>
    </form>

    {#if form?.error}
      <p class="error">{form.error}</p>
    {/if}
  {/if}
</div>

<style>
  .share-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: var(--padding);
  }

  .share-form {
    display: flex;
    flex-direction: row;
    justify-content: stretch;
    align-items: center;
    width: 100%;
    max-width: var(--max-column-width);
    border-color: #88888888;
    border-width: 1px;
    border-radius: 4px;
    border-style: solid;
    padding: var(--padding);
    padding-right: var(--half-padding);
    background-color: var(--background-color);
    color: var(--color);
    height: 48px;
    gap: var(--half-padding);
  }

  .url-input {
    appearance: none;
    display: flex;
    flex-grow: 1;
    font-size: 16px;
    border: 0;
    padding: 0;
    background-color: var(--background-color);
    color: var(--color);
  }

  .url-input:disabled {
    opacity: 0.6;
  }

  .share-button {
    padding: var(--half-padding) var(--padding);
    min-width: 80px;
    font-size: 14px;
  }

  .share-button:disabled {
    opacity: 0.6;
  }

  .error {
    color: #e74c3c;
    margin-top: var(--padding);
    text-align: center;
  }

  .success-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--padding);
  }

  .success-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .site-icon {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    object-fit: contain;
  }

  .checkmark {
    font-size: 48px;
    color: #27ae60;
  }

  .success-container h2 {
    margin: 0;
    font-size: 24px;
  }

  .post-title {
    color: #888;
    margin: 0;
    max-width: var(--max-column-width);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .goto-button {
    padding: var(--padding);
    background: var(--accent-color, #3498db);
    color: white;
    text-decoration: none;
    border-radius: 4px;
    margin-top: var(--padding);
  }

  .goto-button:hover {
    opacity: 0.9;
  }
</style>
