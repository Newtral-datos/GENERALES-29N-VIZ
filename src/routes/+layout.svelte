<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.png';
	import EscrutinioHeader from '#lib/components/EscrutinioHeader.svelte';
	import ChamberTabs from '#lib/components/ChamberTabs.svelte';
	import { ESCRUTINIO_ABIERTO } from '#lib/config';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={favicon} />
</svelte:head>

<div class="page">
	<EscrutinioHeader />
	{#if ESCRUTINIO_ABIERTO}
		<ChamberTabs />
	{/if}
	{@render children()}
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--paper);
	}
</style>
