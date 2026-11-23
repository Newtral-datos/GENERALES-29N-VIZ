<script lang="ts">
	import { getResultados, type Nacional, type Partido } from '#lib/data';
	import { formatMiles } from '#lib/format';
	import { CONVOCATORIA, CONVOCATORIA_ANTERIOR } from '#lib/config';

	let nacional = $state<Nacional | null>(null);

	$effect(() => {
		getResultados().then((d) => {
			nacional = d.nacional;
		});
	});

	// La tabla es `nacional.partidos` tal cual: el pipeline ya la completa con
	// quien tuvo representación en la convocatoria anterior y la ordena por
	// escaños, votos y resultado anterior (ver congreso_29n.con_representacion_anterior
	// y _comun_29n.ordenar_partidos). Rehacer aquí ese criterio daría dos
	// fuentes de verdad para el mismo orden, y acabarían separándose.
	let filas = $derived(nacional?.partidos ?? []);

	// Sin un solo escaño repartido esta noche, la tabla enseña la Cámara que
	// termina: los escaños de 23J, que son un dato fijo y el único que hay a las
	// 20:00. No se mezcla con las columnas de la jornada —votos, % y "Dif." no
	// existen todavía— así que es una tabla distinta, de dos columnas, con su
	// propio rótulo. Mezclarlas daría un "−137" que no es una pérdida: es que
	// aún no se ha contado nada.
	let sinJornada = $derived(filas.length === 0);
	let filasAnteriores = $derived(nacional?.anterior?.partidos ?? []);
</script>

<div class="panel">
	<p class="kicker">
		{sinJornada ? `Composición saliente — ${CONVOCATORIA_ANTERIOR}` : 'Resultados por partido'}
	</p>

	<div class="panel-body">
		{#if !nacional}
			<p class="loading">Cargando datos…</p>
		{:else if sinJornada}
			<div class="tabla-scroll">
				<table class="tabla">
					<thead>
						<tr>
							<th class="th-left">Partido</th>
							<th>Escaños {CONVOCATORIA_ANTERIOR}</th>
						</tr>
					</thead>
					<tbody>
						{#each filasAnteriores as p (p.siglas)}
							<tr>
								<td>
									<div class="party-cell">
										<span class="swatch" style="background:{p.color}"></span>
										<span class="party-name">{p.siglas}</span>
									</div>
								</td>
								<td class="num seats"><span class="seats-num">{p.escanos}</span></td>
							</tr>
						{/each}
						{#if filasAnteriores.length === 0}
							<tr class="fila-vacia">
								<td colspan="2">Sin datos de escrutinio todavía</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
			<p class="nota-espera">Esperando los primeros datos del escrutinio del {CONVOCATORIA}</p>
		{:else}
			<div class="tabla-scroll">
				<table class="tabla">
					<thead>
						<tr>
							<th class="th-left">Partido</th>
							<th>Votos</th>
							<th>%</th>
							<th>Escaños</th>
							<th>Dif.</th>
						</tr>
					</thead>
					<tbody>
						{#each filas as p (p.siglas)}
							{@const dif = p.escanosAnterior === null ? null : p.escanos - p.escanosAnterior}
							<tr>
								<td>
									<div class="party-cell">
										<span class="swatch" style="background:{p.color}"></span>
										<span class="party-name">{p.siglas}</span>
									</div>
								</td>
								<td class="num">{formatMiles(p.votos)}</td>
								<td class="num">{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
								<td class="num seats">
									<!-- Número y flecha en dos columnas fijas: con la flecha
									     dentro de una celda centrada, las filas que la llevan
									     desplazaban el número y los ceros no quedaban en
									     línea. El hueco de la flecha se reserva siempre. -->
									<span class="seats-cell">
										<span class="seats-num">{p.escanos}</span>
										<span class="tendencia" class:sube={dif !== null && dif > 0} class:baja={dif !== null && dif < 0}>
											{#if dif !== null && dif !== 0}{dif > 0 ? '▲' : '▼'}{/if}
										</span>
									</span>
								</td>
								<td class="num">
									{#if dif === null}
										<span class="dif sin-dato" title="No se presentó con esta marca en {CONVOCATORIA_ANTERIOR}, no es comparable">—</span>
									{:else}
										<span class="dif" class:up={dif > 0} class:down={dif < 0}>
											{dif > 0 ? '+' : ''}{dif}
										</span>
									{/if}
								</td>
							</tr>
						{/each}
						{#if filas.length === 0}
							<!-- Estado de las 20:00: la tabla existe, con su cabecera, y dice
							     que todavía no hay recuento. Antes aquí no había nada y la
							     tarjeta se quedaba vacía. -->
							<tr class="fila-vacia">
								<td colspan="5">Sin datos de escrutinio todavía</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
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

	.nota-espera {
		margin: 10px 0 0 0;
		text-align: center;
		font-family: var(--font-body);
		font-size: 10px;
		font-style: italic;
		color: var(--grey);
	}

	.fila-vacia td {
		padding: 18px 0;
		text-align: center;
		font-family: var(--font-body);
		font-size: 11px;
		font-style: italic;
		color: var(--grey);
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
		min-width: 360px;
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

	.seats-cell {
		display: inline-grid;
		grid-template-columns: 2.4em 0.9em;
		align-items: baseline;
	}

	.seats-num {
		text-align: right;
	}

	.tendencia {
		font-size: 8px;
		text-align: left;
		padding-left: 2px;
	}

	.tendencia.sube {
		color: #0a7a4a;
	}

	.tendencia.baja {
		color: var(--stamp);
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

		.dif {
			font-size: 11px;
		}
	}
</style>
