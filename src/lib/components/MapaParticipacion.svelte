<script lang="ts">
	import { CONVOCATORIA } from '#lib/config';
	import { getParticipacion, type ParticipacionProvincia } from '#lib/data';
	import { RAMPA, escalaDe, colorDeAmbito } from '#lib/escala-participacion';
	import { formatMiles } from '#lib/format';
	import { pctDelCorte } from '#lib/participacion';
	import MapaTerritorios from '#lib/components/MapaTerritorios.svelte';
	import MapaParticipacionMunicipios from '#lib/components/MapaParticipacionMunicipios.svelte';

	/**
	 * Mapa de participación, con sus dos niveles en el mismo mapa.
	 *
	 * Antes eran dos mapas independientes: este, con las 52 provincias, y el
	 * municipal **debajo**, precedido de un desplegable de provincia y con un
	 * `scrollIntoView` para bajar hasta él. Cada uno llevaba su propio recuadro de
	 * Canarias, su encuadre y su proyección — 765 líneas entre los dos para
	 * resolver dos veces lo mismo.
	 *
	 * Ahora se reutiliza `MapaTerritorios`, el motor que ya usan la home, el
	 * Senado y `/provincias`: migas de pan, bajada provincia → municipios,
	 * recuadro de Canarias y encuadre, una sola vez. Lo único propio de esta
	 * vista es cómo colorea —escala secuencial de porcentaje, no color de
	 * partido—, su popup y su leyenda, que entran como `color` y como `snippet`.
	 */

	// `activeIdx` viene de ParticipacionView: mismo avance activo que las cajitas
	// de arriba y el ranking, para que el mapa se mueva junto con el resto del
	// bloque según avanza la jornada (-1 = todavía sin ningún avance publicado).
	let { activeIdx }: { activeIdx: number } = $props();

	let provincias = $state<Record<string, ParticipacionProvincia> | null>(null);

	$effect(() => {
		getParticipacion().then((d) => {
			provincias = d.provincias;
		});
	});

	// El nivel en el que está el mapa, para saber si toca enseñar esta leyenda:
	// en el municipal manda la del mapa de municipios, que tiene su propia
	// escala.
	let nivel = $state<'ccaa' | 'provincia' | 'municipio'>('provincia');

	// Valor del avance activo para una provincia; null si ese corte todavía no
	// tiene dato (antes de que se publique, o antes del primer avance de todos).
	//
	// Si la provincia no ha notificado ese corte pero tiene el anterior, se pinta
	// el anterior: `pctDelCorte` resuelve eso en un solo sitio para el mapa, el
	// mapa municipal y el ranking (ver #lib/participacion). El popup lo rotula.
	function pctFor(p: ParticipacionProvincia): number | null {
		if (activeIdx < 0) return null;
		return pctDelCorte(p.avances[activeIdx]).pct;
	}

	/**
	 * La escala se recalcula con los valores del corte activo **y del nivel que
	 * se está viendo**.
	 *
	 * Por corte, porque a las 14:00 toda España cabe en un tramo de la escala del
	 * cierre y el mapa saldría de un solo color. Y por nivel, porque dentro de una
	 * provincia los municipios se reparten en un rango estrecho: con la escala
	 * nacional saldrían todos del mismo tono (decidido el 25/11).
	 *
	 * El precio es que **el mismo color significa cosas distintas en provincias y
	 * en municipios**, así que la leyenda tiene que decir qué rango está
	 * representando — es lo que hace la línea de abajo. Sin eso, comparar los dos
	 * niveles a ojo lleva a conclusiones falsas.
	 */
	let escala = $derived(escalaDe(Object.values(provincias ?? {}).map((p) => pctFor(p))));

	function colorFor(codProv: string): string {
		const p = provincias?.[codProv];
		return colorDeAmbito(p ? pctFor(p) : null, escala);
	}

	let avanceActivo = $derived.by(() => {
		if (activeIdx < 0 || !provincias) return null;
		const alguna = Object.values(provincias)[0];
		return alguna?.avances[activeIdx] ?? null;
	});

	// Cuántas provincias se están pintando con el avance anterior porque no han
	// notificado el corte activo. Va al pie del mapa: el color de esas provincias
	// no es de la hora que dice el rótulo, y eso hay que leerlo sin pasar el ratón
	// por encima. Es la situación normal durante los primeros minutos de un
	// avance, así que la línea se pone y se quita sola según entran las mesas.
	let arrastradas = $derived(
		Object.values(provincias ?? {}).filter(
			(p) => activeIdx >= 0 && pctDelCorte(p.avances[activeIdx]).arrastrado
		).length
	);

	let nota = $derived(
		`${CONVOCATORIA}` +
			(avanceActivo
				? ` — ${avanceActivo.etiqueta.toLowerCase()}${avanceActivo.hora !== 'Cierre' ? ` (${avanceActivo.hora})` : ''}`
				: '') +
			(arrastradas > 0
				? ` — ${arrastradas === 1 ? '1 provincia' : `${arrastradas} provincias`} sin notificar este corte: se pinta${arrastradas === 1 ? '' : 'n'} con el avance anterior`
				: '') +
			' — pasa el ratón por una provincia para ver el detalle, pulsa para bajar a sus municipios'
	);
</script>

<MapaTerritorios
	comunidades={null}
	{provincias}
	nivelInicial="provincia"
	bind:nivel
	color={colorFor}
	{nota}
>
	{#snippet popup(a)}
		<!-- `a as ParticipacionProvincia`: el motor solo se compromete con
		     `{nombre}` —es lo que comparten los cuatro mapas— y cada vista añade
		     lo suyo en su propio popup. Mismo casteo que hacen la home y
		     /provincias. -->
		{@const prov = a as ParticipacionProvincia}
		{@const avance = activeIdx >= 0 ? prov.avances[activeIdx] : null}
		{@const resuelto = pctDelCorte(avance)}
		{@const pct = resuelto.pct}
		<!-- De qué corte sale la cifra: el activo, o el anterior si esta provincia
		     todavía no ha notificado el activo (ver pctDelCorte). -->
		{@const origen = resuelto.arrastrado ?? avance}
		<p class="popup-title">{prov.nombre}</p>
		{#if pct !== null && origen}
			<p class="popup-pct">
				{pct.toLocaleString('es-ES', { minimumFractionDigits: 1 })}<span class="popup-pct-unit"
					>%</span
				>
			</p>
			<p class="popup-sub">
				{formatMiles(origen.votantes!)} de {formatMiles(prov.censo)} censados — {origen.hora}
			</p>
			{#if resuelto.arrastrado && avance}
				<!-- Lo primero que hay que explicar cuando el número no es del corte
				     que el resto del bloque está enseñando. Sin esta línea el mapa
				     diría "18:00" arriba y aquí un porcentaje de las 14:00. -->
				<p class="popup-aviso">
					Aún sin notificar el corte de {avance.hora}: cifra de {resuelto.arrastrado.hora}
				</p>
			{:else if avance?.participacionPctAnterior != null}
				<!-- La comparativa solo con cifra propia del corte: el
				     `participacionPctAnterior` es el de ESTE corte en 2019, así que
				     restarle un porcentaje arrastrado de otra hora daría un delta
				     entre dos cortes distintos. -->
				{@const delta = Math.round((pct - avance.participacionPctAnterior) * 100) / 100}
				<p class="popup-delta" class:up={delta > 0} class:down={delta < 0}>
					{delta > 0 ? '+' : ''}{delta.toLocaleString('es-ES', { minimumFractionDigits: 1 })} pts vs
					{avance.hora} de 2019
				</p>
			{/if}
		{:else}
			<p class="popup-sub">Sin datos todavía</p>
		{/if}
	{/snippet}

	{#snippet leyenda()}
		{#if nivel !== 'municipio'}
			<ul class="leyenda">
				{#each escala.leyenda as label, i (label)}
					<li>
						<span class="leyenda-swatch" style="background:{RAMPA[i]}"></span>
						{label}
					</li>
				{/each}
			</ul>
			<p class="leyenda-rango">Escala ajustada a las 52 provincias en este corte</p>
		{/if}
	{/snippet}

	{#snippet municipios(cod)}
		{#key cod}
			<MapaParticipacionMunicipios {cod} {activeIdx} />
		{/key}
	{/snippet}
</MapaTerritorios>

<style>
.leyenda {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		list-style: none;
		margin: 10px 0 0 0;
		padding: 0;
	}
.leyenda li {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-body);
		font-size: 9px;
		color: var(--grey);
	}
.leyenda-swatch {
		width: 9px;
		height: 9px;
		flex-shrink: 0;
		border: 1px solid var(--border);
	}
.popup-title {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 4px 0;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}
.popup-pct {
		font-family: var(--font-mono);
		font-size: 20px;
		font-weight: 700;
		color: var(--c);
		line-height: 1;
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
.popup-pct-unit {
		font-size: 12px;
		font-weight: 500;
		color: var(--grey);
	}
.popup-sub {
		font-family: var(--font-body);
		font-size: 10px;
		color: var(--grey);
		margin: 3px 0 0 0;
	}
.popup-delta {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--grey);
		margin: 4px 0 0 0;
	}
.popup-delta.up {
		color: #0a7a4a;
	}
.popup-delta.down {
		color: var(--stamp);
	}

	/* El aviso de que la cifra es del corte anterior. En cursiva y del tamaño de
	   `.popup-sub`, no en el rojo del sello: no es una alarma ni un error, es una
	   nota de procedencia del dato — esa provincia no ha notificado todavía. */
	.popup-aviso {
		font-family: var(--font-body);
		font-size: 10px;
		font-style: italic;
		color: var(--grey);
		margin: 4px 0 0 0;
	}

	/* Qué rango representa la escala. Hace falta porque la escala se recalcula
	   por nivel y por corte: sin esta línea, dos mapas con los mismos colores
	   parecen comparables y no lo son. */
	.leyenda-rango {
		margin: 4px 0 0;
		text-align: center;
		font-family: var(--font-body);
		font-size: 9px;
		font-style: italic;
		color: #9ca3af;
	}
</style>
