<script lang="ts">
  import { page } from '$app/state'
  import { prefix } from '$lib/prefix'

  // Only the statuses this app actually raises; anything else falls back to "Error".
  const REASONS: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    500: 'Internal Error',
  }

  const reason = $derived(REASONS[page.status])
  const heading = $derived(reason ? `Error ${page.status} (${reason})` : `Error ${page.status}`)
</script>

<svelte:head>
  <title>{heading}</title>
</svelte:head>

<div class="error-page">
  <h2>{heading}</h2>
  {#if page.error?.message}
    <p class="explanation">{page.error.message}</p>
  {/if}
  <a class="back" href="{prefix()}/">Back to the feed</a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-height: 60vh;
    padding: var(--padding);
    padding-top: calc(var(--padding) * 4);
    gap: var(--padding);
  }

  h2 {
    margin: 0;
    font-size: 24px;
  }

  .explanation {
    color: #888;
    margin: 0;
    max-width: var(--max-column-width);
  }

  .back {
    margin-top: var(--padding);
    color: inherit;
  }
</style>
