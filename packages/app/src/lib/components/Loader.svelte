<script lang="ts">
  type Dimension = 'default' | 'large' | 'compact' | 'small'
  type Props = {
    dimension?: Dimension
  }
  const { dimension = 'default' }: Props = $props()

  function dimensionToSize(d: Dimension): number {
    switch (d) {
      case 'large':
        return 32
      case 'default':
        return 24
      case 'compact':
        return 24
      case 'small':
        return 16
    }
  }

  const size = $derived(dimensionToSize(dimension))
</script>

<div class="loader" style="width: {size}px"></div>

<style>
  .loader {
    width: 50px;
    padding: 2px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--color);
    mask:
      conic-gradient(#0000 10%, #000),
      linear-gradient(#000 0 0) content-box;
    -webkit-mask-composite: source-out;
    mask-composite: subtract;
    animation: spin 1s infinite linear;
  }
  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }
</style>
