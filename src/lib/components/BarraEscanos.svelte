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
			<span class="maj-line"></span>
			<span class="maj-text">Mayoría — {nacional.mayoria}</span>
		</div>
	</div>

	<div class="legend">
		{#each nacional.partidos as p (p.siglas)}
			<div class="chip">
				<span class="dot" style="background:{p.color}"></span>
				<span class="chip-name">{p.siglas}</span>
				<span class="chip-value">{p.escanos}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: 'Instrument Sans', system-ui;
		padding: 16px 0;
		text-align: center;
	}

	.barra-wrap {
		position: relative;
		padding-top: 22px;
	}

	.barra {
		display: flex;
		width: 100%;
		height: 36px;
		overflow: hidden;
		border-radius: 0;
	}

	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		border-right: 1.5px solid rgba(255, 255, 255, 0.6);
	}
	.seg:last-child {
		border-right: none;
	}

	.seg-label {
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.maj-marker {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.maj-line {
		width: 2px;
		height: 36px;
		margin-top: 22px;
		background: repeating-linear-gradient(
			to bottom,
			#0d1117 0,
			#0d1117 4px,
			transparent 4px,
			transparent 7px
		);
	}

	.maj-text {
		position: absolute;
		top: 0;
		white-space: nowrap;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--ink);
		font-family: 'Instrument Sans', system-ui;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		margin-top: 16px;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 8px;
		border-radius: 5px;
		border: 1px solid #f3f4f6;
		background: #f8fafc;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.chip-name {
		font-size: 11px;
		color: #6b7280;
		font-family: 'Instrument Sans', system-ui;
	}

	.chip-value {
		font-size: 11px;
		font-weight: 700;
		color: var(--ink);
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}
</style>
