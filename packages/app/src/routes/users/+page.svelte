<script lang="ts">
  const { data }: { data: { users: string[] } } = $props()
</script>

<div class="users">
  <h1>Users</h1>
  {#if data.users.length === 0}
    <p class="empty">No users yet. Create a <code>@name</code> folder in the data directory.</p>
  {:else}
    <ul>
      {#each data.users as user (user)}
        <li><a href="/@{user}">@{user}</a></li>
      {/each}
    </ul>
  {/if}
  <p class="single-user"><a href="/">Single-user feed</a></p>
</div>

<style>
  .users {
    max-width: 600px;
    margin: 0 auto;
    padding: var(--padding);
  }

  ul {
    list-style: none;
    padding: 0;
  }

  li a {
    display: block;
    padding: 0.75rem 0;
    color: var(--color);
    text-decoration: none;
    border-bottom: 1px solid var(--color-step-20);
  }

  li a:hover {
    text-decoration: underline;
  }

  .empty,
  .single-user {
    color: var(--color-step-30);
  }
</style>
