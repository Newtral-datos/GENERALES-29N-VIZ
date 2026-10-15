<script lang="ts">
	import { getResultadosSenado23j, type NacionalSenado } from '#lib/data';

	let nacional = $state<NacionalSenado | null>(null);

	$effect(() => {
		getResultadosSenado23j().then((d) => {
			nacional = d.nacional;
		});
	});
</script>

<div class="panel">
	<p class="kicker">Senadores electos por partido</p>

	<div class="panel-body">
		{#if !nacional}
			<p class="loading">Cargando datos…</p>
		{:else}
			<div class="tabla-scroll">
				<table class="tabla">
					<thead>
						<tr>
							<th class="th-left">Partido</th>
							<th>Escaños</th>
							<th>Dif.</th>
						</tr>
					</thead>
					<tbody>
						{#each nacional.partidos as p (p.siglas)}
							{@const dif = p.escanos - p.escanosAnterior}
							<tr>
								<td>
									<div class="party-cell">
										<span class="swatch" style="background:{p.color}"></span>
										<span class="party-name">{p.siglas}</span>
									</div>
								</td>
								<td class="num seats">{p.escanos}</td>
								<td class="num">
									<span class="dif" class:up={dif > 0} class:down={dif < 0}>
										{dif > 0 ? '+' : ''}{dif}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="nota">Senadores de elección directa — no incluye a los designados por las comunidades autónomas</p>
			<p class="nota">Columna "Dif." — comparativa con la elección anterior (datos simulados)</p>
		{/if}
	</div>
</div>

<style>
	.panel {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.kicker {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 10px 0;
		text-align: center;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
	}

	.tabla-scroll {
		width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-top: 1px solid var(--border);
	}

	.tabla {
		width: 100%;
		min-width: 280px;
		border-collapse: collapse;
	}

	.tabla thead tr {
		border-bottom: 1px solid var(--border);
	}

	.tabla th {
		padding: 4px 6px;
		text-align: center;
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grey);
	}

	.tabla th.th-left {
		text-align: left;
	}

	.tabla tbody tr {
		border-bottom: 1px solid var(--border);
		transition: background 0.1s ease;
	}

	.tabla tbody tr:hover {
		background: #fafafa;
	}

	.tabla td {
		padding: 4px 6px;
	}

	.swatch {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
		transform: translateY(1px);
	}

	.party-cell {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.party-name {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink);
	}

	.num {
		text-align: center;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--grey);
		font-variant-numeric: tabular-nums;
	}

	.num.seats {
		font-size: 12px;
		font-weight: 700;
		color: var(--ink);
	}

	.dif {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--grey);
	}

	.dif.up {
		color: #0a7a4a;
	}

	.dif.down {
		color: var(--stamp);
	}

	.nota {
		font-size: 10px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 10px 0 0 0;
		text-align: center;
	}

	@media (max-width: 640px) {
		.tabla {
			min-width: 0;
		}

		.tabla th {
			padding: 4px 3px;
			font-size: 9px;
		}

		.tabla td {
			padding: 4px 3px;
		}

		.party-name {
			font-size: 11px;
		}

		.num {
			font-size: 11px;
		}

		.num.seats {
			font-size: 12px;
		}
	}
</style>
