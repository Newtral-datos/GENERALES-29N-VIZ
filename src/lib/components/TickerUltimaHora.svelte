<script lang="ts">
	import { ESCRUTINIO_ABIERTO } from '#lib/config';
	import { TITULARES_ANTES, generarTitularesDirecto } from '#lib/ticker-content';
	import { getResultados23j, getParticipacion23j } from '#lib/data';

	let titulares = $state<string[]>(ESCRUTINIO_ABIERTO ? [] : TITULARES_ANTES);

	$effect(() => {
		if (!ESCRUTINIO_ABIERTO) return;
		Promise.all([getResultados23j(), getParticipacion23j()]).then(([resultados, participacion]) => {
			titulares = generarTitularesDirecto(resultados.nacional, participacion);
		});
	});
</script>

<div class="ticker-wrap">
	<span class="ticker-tag"><span class="punto"></span>Última hora</span>
	<div class="ticker-pista">
		<div class="ticker-cinta">
			{#each [...titulares, ...titulares] as t, i (i)}
				<span class="ticker-item">{@html t}</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.ticker-wrap {
		display: flex;
		align-items: stretch;
		height: 36px;
		border-top: 1px solid var(--ink);
		border-bottom: 1px solid var(--border);
		overflow: hidden;
	}

	.ticker-tag {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--ink);
		color: var(--c);
		font-family: var(--font-body);
		font-weight: 800;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0 14px;
	}

	.ticker-tag .punto {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--c);
		animation: pulso 1.3s ease-in-out infinite;
	}

	@keyframes pulso {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ticker-tag .punto {
			animation: none;
		}
	}

	.ticker-pista {
		overflow: hidden;
		flex: 1;
		background: var(--paper);
	}

	.ticker-cinta {
		display: flex;
		height: 100%;
		width: max-content;
		align-items: center;
		animation: desfile 28s linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.ticker-cinta {
			animation: none;
		}
	}

	@keyframes desfile {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	.ticker-item {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink);
		white-space: nowrap;
		padding: 0 20px;
		border-right: 1px solid var(--rule);
	}

	.ticker-item :global(b) {
		color: var(--c);
	}
</style>
