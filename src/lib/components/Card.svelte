<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<div class="card">
	{#if title}
		<div class="card-header">
			<span class="teal-bar"></span>
			<span class="card-label">{title}</span>
		</div>
	{/if}
	<div class="card-body">
		{@render children()}
	</div>
</div>

<style>
	.card {
		background: #fff;
		border: 1px solid #e5e7eb;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 18px;
		background: #fafafa;
		border-bottom: 1px solid #f0f0f0;
		flex-shrink: 0;
	}

	.teal-bar {
		display: inline-block;
		width: 3px;
		height: 14px;
		border-radius: 2px;
		background: var(--c);
		flex-shrink: 0;
	}

	.card-label {
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--grey);
		flex: 1;
		text-align: center;
	}

	.card-body {
		padding: 16px;
		flex: 1;
		min-height: 0;
	}
</style>
