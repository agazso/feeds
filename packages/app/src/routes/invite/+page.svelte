<script lang="ts">
  import type { ActionData } from './$types'

  const { form }: { form: ActionData } = $props()
</script>

<svelte:head>
  <title>Invite a user</title>
</svelte:head>

<div class="invite-page">
  <h2>Invite a user</h2>
  <p class="explanation">
    Creates <code>/@name</code> with its own feeds and posts, and gives you a link to share with them.
  </p>

  <form method="POST" class="invite-form">
    <input name="name" placeholder="name" autocapitalize="none" autocomplete="off" />
    <button type="submit">Create invite</button>
    {#if form?.message}
      <p class="error">
        {form.message}
        {#if form.existing}
          <a href="/invite/{form.existing}">Show its link</a>
        {/if}
      </p>
    {/if}
  </form>
</div>

<style>
  .invite-page {
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

  code {
    background: #88888822;
    padding: 0 4px;
    border-radius: 4px;
    font-size: 0.9em;
  }

  .invite-form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--padding);
    width: 100%;
    max-width: 320px;
    margin-top: var(--padding);
  }

  .invite-form input {
    padding: var(--half-padding) var(--padding);
    font-size: 16px;
    border: 1px solid #88888888;
    border-radius: 4px;
    background: var(--background-color);
    color: var(--color);
  }

  .invite-form button {
    padding: var(--half-padding) var(--padding);
    font-size: 16px;
    cursor: pointer;
  }

  .error {
    color: #e74c3c;
    margin: 0;
  }

  .error a {
    color: inherit;
  }
</style>
