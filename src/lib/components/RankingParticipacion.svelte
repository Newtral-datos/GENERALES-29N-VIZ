<script lang="ts">
	import { getParticipacion23j, type ParticipacionProvincia } from '#lib/data';

	let provincias = $state<[string, ParticipacionProvincia][] | null>(null);

	$effect(() => {
		getParticipacion23j().then((d) => {
			provincias = Object.entries(d.provincias).sort((a, b) => b[1].participacionPct - a[1].participacionPct);
		});
	});
</script>

<div class="panel">
	<p class="kicker">Ranking de provincias</p>

	{#if !provincias}
		<p class="loading">Cargando…</p>
	{:else}
		<ul class="ranking">
			{#each provincias as [cod, p], i (cod)}
				<li>
					<span class="rank">{i + 1}</span>
					<span class="nombre">{p.nombre}</span>
					<span class="bar-track">
						<span class="bar-fill" style="width:{p.participacionPct}%"></span>
					</span>
					<span class="valor">{p.participacionPct.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.kicker {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 8px 0;
		text-align: center;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
		text-align: center;
	}

	.ranking {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		max-height: 420px;
		border-top: 1px solid var(--border);
	}

	.ranking li {
		display: grid;
		grid-template-columns: 18px 84px 1fr 44px;
		align-items: center;
		gap: 8px;
		padding: 4px 4px;
		border-bottom: 1px solid #f0f0f0;
	}

	.rank {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--grey);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.nombre {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar-track {
		position: relative;
		height: 10px;
		background: var(--rule);
	}

	.bar-fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--c);
		border-radius: 0 4px 4px 0;
	}

	.valor {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--ink);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 640px) {
		.ranking li {
			grid-template-columns: 16px 68px 1fr 40px;
		}
	}
</style>
