<script lang="ts">
import type { PageData, ActionData } from './$types'
import CopyLink from '$lib/components/CopyLink.svelte'

let { data, form }: { data: PageData; form: ActionData } = $props()

const showInvalid = $derived(form?.invalid === true || data.invalidKey)
// A key authenticates one scope: the /@name path it was used on, else the root feed.
const scope = $derived(data.user ? `@${data.user}` : 'root')

// Kept behind a click: the link carries the key, so it shouldn't sit on screen.
let showLink = $state(false)
</script>

<svelte:head>
  <title>Authentication</title>
</svelte:head>

<div class="auth-page">
  {#if !data.authEnabled}
    <h2>Authentication disabled</h2>
    <p class="explanation">
      Authentication is disabled on this server. Everyone can add and edit content.
    </p>
  {:else if data.authenticated}
    <div class="status-icon"><span class="checkmark">&#10003;</span></div>
    <h2>Authenticated as {scope}</h2>
    <p class="explanation">You can add and edit feeds and posts.</p>
    {#if data.signInUrl}
      {#if showLink}
        <p class="explanation">
          Open this on another device to sign in there as {scope}. It carries your key —
          treat it like a password.
        </p>
        <CopyLink url={data.signInUrl} />
      {:else}
        <button type="button" class="link-button" onclick={() => (showLink = true)}>
          Show sign-in link
        </button>
      {/if}
    {/if}
    <form method="POST" action="?/logout" class="auth-form">
      <button type="submit">Log out</button>
    </form>
  {:else}
    <h2>Enter access key</h2>
    <p class="explanation">
      Enter your access key to enable adding and editing feeds and posts. You can also
      open this page with the key in the URL: <code>/auth?key=YOUR_KEY</code>.
    </p>
    <form method="POST" action="?/login" class="auth-form">
      <input
        type="password"
        name="key"
        placeholder="Access key"
        autocomplete="current-password"
      />
      <button type="submit">Authenticate</button>
      {#if showInvalid}
        <p class="error">Invalid key. Please try again.</p>
      {/if}
    </form>
  {/if}
</div>

<style>
  .auth-page {
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

  .status-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .checkmark {
    font-size: 48px;
    color: #27ae60;
  }

  code {
    background: #88888822;
    padding: 0 4px;
    border-radius: 4px;
    font-size: 0.9em;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--padding);
    width: 100%;
    max-width: 320px;
    margin-top: var(--padding);
  }

  .auth-form input {
    padding: var(--half-padding) var(--padding);
    font-size: 16px;
    border: 1px solid #88888888;
    border-radius: 4px;
    background: var(--background-color);
    color: var(--color);
  }

  .auth-form button {
    padding: var(--half-padding) var(--padding);
    font-size: 16px;
    cursor: pointer;
  }

  .link-button {
    padding: var(--half-padding) var(--padding);
    font-size: 16px;
    cursor: pointer;
    margin-top: var(--padding);
  }

  .error {
    color: #e74c3c;
    margin: 0;
  }
</style>
