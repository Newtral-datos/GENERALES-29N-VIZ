<script lang="ts">
	import { CONVOCATORIA_ANTERIOR } from '#lib/config';
	import { getParticipacion, type ArrastreAvance, type ParticipacionProvincia } from '#lib/data';
	import { pctDelCorte } from '#lib/participacion';

	// activeIdx viene de ParticipacionView: mismo avance activo que las
	// cajitas de arriba y el mapa.
	let { activeIdx }: { activeIdx: number } = $props();

	let provincias = $state<Record<string, ParticipacionProvincia> | null>(null);

	$effect(() => {
		getParticipacion().then((d) => {
			provincias = d.provincias;
		});
	});

	// Mismo motivo que el rótulo de los dos mapas: con las tres cajas de arriba
	// enseñando cifra, el ranking tiene que decir de qué corte es el suyo.
	let corteActivo = $derived.by(() => {
		if (!provincias || activeIdx < 0) return null;
		return Object.values(provincias)[0]?.avances[activeIdx] ?? null;
	});

	let filas = $derived.by(() => {
		if (!provincias || activeIdx < 0) return [];
		return Object.entries(provincias)
			.map(([cod, p]) => {
				const resuelto = pctDelCorte(p.avances[activeIdx]);
				return {
					cod,
					nombre: p.nombre,
					pct: resuelto.pct,
					// De qué corte es la cifra cuando no es del activo (ver
					// pctDelCorte). `null` = cifra propia de este corte.
					arrastrado: resuelto.arrastrado,
					// El mismo corte en la convocatoria anterior. Es el listón que
					// marca la referencia negra sobre la barra. Solo tiene sentido
					// con cifra propia: contra un porcentaje de otra hora compararía
					// dos cortes distintos.
					previo: resuelto.arrastrado
						? null
						: (p.avances[activeIdx]?.participacionPctAnterior ?? null)
				};
			})
			.filter((p): p is Fila => p.pct !== null);
	});

	type Fila = {
		cod: string;
		nombre: string;
		pct: number;
		arrastrado: ArrastreAvance | null;
		previo: number | null;
	};

	/**
	 * El ranking lo forman **solo** las provincias con cifra propia de este corte.
	 *
	 * Las que todavía no han notificado se listan aparte, debajo, con su hora.
	 * Podrían entrar en la lista con su cifra arrastrada —el mapa sí las pinta,
	 * porque allí cada provincia se lee por separado—, pero esto es un ranking: un
	 * orden. Y la participación de las 14:00 es por definición más baja que la de
	 * las 18:00, así que mezclarlas mandaría al fondo de la tabla a provincias que
	 * no están votando menos, solo contando más tarde — el mismo error que el
	 * AGENTS.md avisa del filtro de "está en juego": el titular sugiere una
	 * selección que no existe.
	 */
	let ranking = $derived(filas.filter((p) => !p.arrastrado).sort((a, b) => b.pct - a.pct));

	// Fuera del orden, pero no fuera de la pieza: antes se caían de la lista sin
	// dejar rastro y el ranking pasaba de 52 filas a 30 sin decir por qué.
	let sinNotificar = $derived(filas.filter((p) => p.arrastrado).sort((a, b) => b.pct - a.pct));
</script>

<div class="panel">
	<p class="kicker">
		Ranking de provincias{#if corteActivo}
			— {corteActivo.etiqueta.toLowerCase()}{corteActivo.hora !== 'Cierre' ? ` (${corteActivo.hora})` : ''}
		{/if}
	</p>

	{#if !provincias}
		<p class="loading">Cargando…</p>
	{:else if activeIdx < 0}
		<p class="loading">Esperando el primer avance de participación…</p>
	{:else}
		<ul class="ranking">
			{#each ranking as p, i (p.cod)}
				<li>
					<span class="rank">{i + 1}</span>
					<span class="nombre">{p.nombre}</span>
					<span class="bar-track">
						<span class="bar-fill" style="width:{p.pct}%"></span>
						{#if p.previo !== null}
							<!-- Marca de referencia: dónde estaba esta provincia en el
							     mismo corte de la convocatoria anterior. Negra y fina a
							     propósito — no es una segunda serie, es el listón contra
							     el que se lee la barra. -->
							<span
								class="marca-anterior"
								style="left:{p.previo}%"
								title={`${CONVOCATORIA_ANTERIOR}: ${p.previo.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%`}
							></span>
						{/if}
					</span>
					<span class="valor">{p.pct.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%</span>
				</li>
			{/each}
		</ul>

		{#if sinNotificar.length > 0}
			<!-- Las que no han notificado este corte: fuera del orden (ver `ranking`)
			     pero a la vista, con la hora de la cifra que se enseña. Sin número de
			     posición, que es justo lo que no tienen. -->
			<p class="sub-kicker">
				Sin notificar este corte — última cifra disponible
			</p>
			<ul class="ranking pendientes">
				{#each sinNotificar as p (p.cod)}
					<li>
						<span class="rank rank-hora">{p.arrastrado?.hora}</span>
						<span class="nombre">{p.nombre}</span>
						<span class="bar-track">
							<span class="bar-fill" style="width:{p.pct}%"></span>
						</span>
						<span class="valor">{p.pct.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%</span>
					</li>
				{/each}
			</ul>
		{/if}
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



	.marca-anterior {
		position: absolute;
		top: -2px;
		bottom: -2px;
		width: 2px;
		/* Sobresale un poco por arriba y por abajo para que se distinga del
		   final de la barra cuando los dos valores casi coinciden. */
		background: var(--ink);
		transform: translateX(-1px);
	}

	.valor {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--ink);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	/* Rótulo del grupo de las que no han notificado. Mismo lenguaje que el
	   `kicker` de arriba pero en minúscula y gris: encabeza un apartado
	   secundario, no otra pieza. */
	.sub-kicker {
		font-family: var(--font-body);
		font-size: 9px;
		font-style: italic;
		color: var(--grey);
		margin: 10px 0 4px 0;
		text-align: center;
	}

	/* El grupo de abajo, apagado: la cifra es real pero de otra hora, así que no
	   debe competir con el ranking de verdad. Sin `max-height` propio ni scroll
	   aparte — son pocas filas y solo durante los minutos en que entra un avance.
	   La primera columna crece porque ahí va la hora ("14:00") en vez de un
	   número de posición, que estas filas no tienen. */
	.pendientes {
		max-height: none;
		opacity: 0.75;
	}

	.pendientes li {
		grid-template-columns: 34px 84px 1fr 44px;
	}

	.rank-hora {
		font-size: 8px;
		letter-spacing: -0.02em;
	}

	@media (max-width: 640px) {
		.ranking li {
			grid-template-columns: 16px 68px 1fr 40px;
		}

		.pendientes li {
			grid-template-columns: 32px 68px 1fr 40px;
		}
	}
</style>
