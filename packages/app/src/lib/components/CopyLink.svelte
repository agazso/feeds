<script lang="ts">
  const { url }: { url: string } = $props()

  let copied = $state(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      copied = true
      setTimeout(() => (copied = false), 2000)
    } catch {
      // Clipboard blocked (insecure origin, denied permission) — the link is on screen.
    }
  }
</script>

<div class="link-row">
  <input class="link" readonly value={url} onfocus={(e) => e.currentTarget.select()} />
  <button type="button" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
</div>

<style>
  .link-row {
    display: flex;
    gap: var(--half-padding);
    width: 100%;
    max-width: 520px;
    margin-top: var(--padding);
  }

  .link {
    flex: 1;
    min-width: 0;
    padding: var(--half-padding) var(--padding);
    font-size: 14px;
    border: 1px solid #88888888;
    border-radius: 4px;
    background: var(--background-color);
    color: var(--color);
  }

  button {
    padding: var(--half-padding) var(--padding);
    font-size: 16px;
    cursor: pointer;
  }
</style>
