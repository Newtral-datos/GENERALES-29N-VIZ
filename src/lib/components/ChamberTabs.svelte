<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const tabs = [
		{ label: 'Congreso', href: resolve('/') },
		{ label: 'Senado', href: resolve('/senado') }
	];
</script>

<nav class="tabs">
	{#each tabs as t (t.href)}
		<a href={t.href} class="tab" class:active={page.url.pathname === t.href}>{t.label}</a>
	{/each}
</nav>

<style>
	.tabs {
		display: flex;
		justify-content: center;
		gap: 24px;
		padding: 0 24px;
		border-bottom: 1px solid var(--border);
		background: var(--paper);
	}

	.tab {
		display: inline-block;
		padding: 5px 2px;
		margin-bottom: -1px;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grey);
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}

	.tab:hover {
		color: var(--ink);
	}

	.tab.active {
		color: var(--ink);
		border-bottom-color: var(--c);
	}

	@media (max-width: 640px) {
		.tabs {
			padding: 0 16px;
			gap: 18px;
		}
	}
</style>
