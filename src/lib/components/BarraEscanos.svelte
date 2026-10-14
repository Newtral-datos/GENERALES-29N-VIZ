<script lang="ts">
	import { getResultados23j, type Nacional } from '#lib/data';

	let nacional = $state<Nacional | null>(null);

	$effect(() => {
		getResultados23j().then((d) => {
			nacional = d.nacional;
		});
	});

	let segments = $derived.by(() => {
		if (!nacional) return [];
		const left = nacional.partidos.filter((p) => p.lado === 1).sort((a, b) => b.escanos - a.escanos);
		const right = nacional.partidos.filter((p) => p.lado === 2).sort((a, b) => a.escanos - b.escanos);
		return [...left, ...right].map((p) => ({ ...p, pct: (p.escanos / nacional!.totalEscanos) * 100 }));
	});

	let mayoriaPct = $derived(nacional ? (nacional.mayoria / nacional.totalEscanos) * 100 : 0);
</script>

{#if !nacional}
	<p class="loading">Cargando datos…</p>
{:else}
	<div class="barra-wrap">
		<div class="barra">
			{#each segments as s (s.siglas)}
				<div class="seg" style="width:{s.pct}%; background:{s.color}" title="{s.siglas}: {s.escanos}">
					{#if s.pct >= 4}
						<span class="seg-label">{s.escanos}</span>
					{/if}
				</div>
			{/each}
		</div>
		<div class="maj-marker" style="left:{mayoriaPct}%">
			<span class="maj-text">Mayoría<br /><b>{nacional.mayoria}</b></span>
			<span class="maj-line"></span>
		</div>
	</div>

	<ul class="legend">
		{#each nacional.partidos as p (p.siglas)}
			<li class="entry">
				<span class="swatch" style="background:{p.color}"></span>
				<span class="entry-name">{p.siglas}</span>
				<span class="entry-value">{p.escanos}</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 16px 0;
		text-align: center;
	}

	.barra-wrap {
		position: relative;
		padding-top: 24px;
	}

	.barra {
		display: flex;
		width: 100%;
		height: 34px;
		overflow: hidden;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		border-right: 1px solid var(--border);
	}
	.seg:last-child {
		border-right: none;
	}

	.seg-label {
		color: #fff;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.maj-marker {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.maj-text {
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--ink);
		text-align: center;
		line-height: 1.3;
	}

	.maj-text b {
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.maj-line {
		width: 1px;
		height: 34px;
		background: var(--ink);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 18px;
		margin: 14px 0 0 0;
		padding: 0;
		list-style: none;
	}

	.entry {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.swatch {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
		transform: translateY(1px);
	}

	.entry-name {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--grey);
	}

	.entry-value {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
</style>
