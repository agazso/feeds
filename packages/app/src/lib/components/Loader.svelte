<script lang="ts">
	type Dimension = 'default' | 'large' | 'compact' | 'small'
	type Props = {
		dimension?: Dimension
	}
	let { dimension = 'default' }: Props = $props()

	let size = dimensionToSize(dimension)

	function dimensionToSize(dimension: Dimension): number {
		switch (dimension) {
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
