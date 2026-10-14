<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import EscrutinioHeader from '#lib/components/EscrutinioHeader.svelte';
	import ChamberTabs from '#lib/components/ChamberTabs.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="page">
	<EscrutinioHeader />
	<ChamberTabs />
	{@render children()}
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--paper);
	}
</style>
