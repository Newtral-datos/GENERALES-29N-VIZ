<script lang="ts">
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection } from '#lib/geo';
	import { assetDinamico, getParticipacionMunicipios, type ParticipacionMunicipio } from '#lib/data';
	import { RAMPA, escalaDe, colorDeAmbito } from '#lib/escala-participacion';
	import { CONVOCATORIA_ANTERIOR } from '#lib/config';

	type MuniProps = { NATCODE: string; NAMEUNIT: string; cod_prov: string };
	type Feature = GeoFeature<MuniProps>;

	/**
	 * `activeIdx` viene de la vista, no se recalcula aquí: es el mismo corte que
	 * enseñan el número grande, el mapa de provincias y el ranking de esta
	 * página, y recalcularlo por separado los dejaría descoordinados cuando
	 * entre un avance nuevo (ver AGENTS.md, "Participación y avances").
	 */
	let {
		cod,
		activeIdx,
		onListo
	}: {
		cod: string;
		activeIdx: number;
		/** Avisa cuando la geometría y los datos ya están pintados. Quien llama
		 *  lo necesita para colocar el scroll: hasta que el mapa no existe, este
		 *  bloque mide lo que mide el texto de "cargando". */
		onListo?: () => void;
	} = $props();

	let features = $state<Feature[] | null>(null);
	let datos = $state<Record<string, ParticipacionMunicipio> | null>(null);

	$effect(() => {
		const codActual = cod;
		features = null;
		datos = null;
		// La geometría municipal se carga por provincia: el fichero nacional son
		// ~130 MB en crudo y 4 MB simplificado repartido en 52, así que traerlas
		// todas para enseñar una sería absurdo.
		fetch(assetDinamico(`data/municipios/${codActual}.geojson`), { cache: 'no-cache' })
			.then((res) => res.json())
			.then((d: FeatureCollection<MuniProps>) => {
				features = d.features;
			})
			.catch(() => {
				features = [];
			});
		getParticipacionMunicipios(codActual)
			.then((d) => {
				datos = d;
			})
			.catch(() => {
				datos = {};
			});
	});

	// Qué corte se está pintando, para poder nombrarlo al pie: desde que los
	// avances ya publicados se conservan, las cajas de arriba enseñan tres
	// cifras a la vez y un mapa sin rótulo no dice a cuál corresponde. La hora y
	// la etiqueta son iguales en todos los municipios.
	let corteActivo = $derived.by(() => {
		if (activeIdx < 0 || !datos) return null;
		return Object.values(datos)[0]?.avances[activeIdx] ?? null;
	});

	function ine(natcode: string): string {
		// El NATCODE del geojson es el código GISCO; los 5 últimos dígitos son el
		// INE de provincia + municipio, que es la clave de los resultados.
		return natcode.slice(-5);
	}

	function pctDe(natcode: string): number | null {
		if (activeIdx < 0) return null;
		return datos?.[ine(natcode)]?.avances[activeIdx]?.participacionPct ?? null;
	}

	// Escala propia de esta provincia y de este corte: el reparto entre sus
	// municipios no tiene por qué parecerse al del mapa nacional.
	let escala = $derived(
		escalaDe(
			Object.keys(datos ?? {}).map((ine) => datos?.[ine]?.avances[activeIdx]?.participacionPct)
		)
	);

	function colorFor(natcode: string): string {
		return colorDeAmbito(pctDe(natcode), escala);
	}

	const W = 420;
	const H = 320;

	// Un solo aviso por provincia, cuando ya están las dos piezas.
	let avisado = $state('');
	$effect(() => {
		if (features && datos && features.length && avisado !== cod) {
			avisado = cod;
			onListo?.();
		}
	});

	let bounds = $derived(features && features.length ? computeBounds(features) : null);
	let vp = $derived(bounds ? fitBox(bounds, W, H) : { w: W, h: H });

	// Popup al pasar el ratón: el <title> nativo no se puede maquetar y es
	// invisible en móvil (AGENTS.md, "Mapas coropléticos").
	let activo = $state<{
		nombre: string;
		pct: number | null;
		censo: number | null;
		anterior: number | null;
	} | null>(null);
	let popupPos = $state({ x: 0, y: 0 });
	const POPUP_W = 180;
	const POPUP_H = 110;

	function colocar(x: number, y: number) {
		// Voltea al lado contrario del cursor cuando no cabe, en vez de recortar
		// contra el borde.
		const cabeDerecha = window.innerWidth - x >= POPUP_W + 20;
		const left = cabeDerecha ? x + 12 : x - POPUP_W - 12;
		const cabeAbajo = window.innerHeight - y >= POPUP_H + 20;
		popupPos = {
			x: Math.min(Math.max(left, 8), window.innerWidth - POPUP_W - 8),
			y: cabeAbajo ? y + 12 : y - POPUP_H - 12
		};
	}

	function onEnter(e: MouseEvent, f: Feature) {
		const d = datos?.[ine(f.properties.NATCODE)];
		const corte = activeIdx >= 0 ? d?.avances[activeIdx] : null;
		activo = {
			nombre: d?.nombre || f.properties.NAMEUNIT,
			pct: pctDe(f.properties.NATCODE),
			censo: d?.censo ?? null,
			// Solo el cierre trae comparativa: la API no publica los avances de
			// la convocatoria anterior.
			anterior: corte?.participacionPctAnterior ?? null
		};
		colocar(e.clientX, e.clientY);
	}

	function onMove(e: MouseEvent) {
		colocar(e.clientX, e.clientY);
	}

	function onLeave() {
		activo = null;
	}

	function formatoEntero(n: number): string {
		// `toLocaleString('es-ES')` no pone el punto de millar cuando hay un solo
		// dígito antes del primer grupo (9500 -> "9500"): se inserta a mano.
		return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	}
</script>

<section class="panel">
	<p class="kicker">Participación por municipio</p>

	<div class="panel-body">
		{#if !features || !datos}
			<p class="loading">Cargando mapa…</p>
		{:else if features.length === 0}
			<p class="loading">No hay geometría de esta provincia</p>
		{:else}
			<div class="wrap">
				<svg viewBox="0 0 {vp.w} {vp.h}" class="mapa">
					{#each features as f (f.properties.NATCODE)}
						{#each featurePaths(f, bounds!, vp.w, vp.h) as d, i (i)}
							<path
								{d}
								fill={colorFor(f.properties.NATCODE)}
								stroke="#d8d8d8"
								stroke-width="0.4"
								class="muni"
								role="img"
								aria-label={f.properties.NAMEUNIT}
								onmouseenter={(e) => onEnter(e, f)}
								onmousemove={onMove}
								onmouseleave={onLeave}
							/>
						{/each}
					{/each}
				</svg>

				{#if activo}
					<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
						<span class="popup-nombre">{activo.nombre}</span>
						{#if activo.pct !== null}
							<span class="popup-pct">
								{activo.pct.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%
							</span>
						{:else}
							<span class="popup-pendiente">Corte pendiente</span>
						{/if}
						{#if activo.pct !== null && activo.anterior !== null}
							{@const d = activo.pct - activo.anterior}
							<span class="popup-delta" class:sube={d > 0} class:baja={d < 0}>
								{d > 0 ? '+' : ''}{d.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								pts respecto a {CONVOCATORIA_ANTERIOR}
								<span class="popup-anterior">
									({activo.anterior.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%)
								</span>
							</span>
						{/if}
						{#if activo.censo !== null}
							<span class="popup-censo">Censo {formatoEntero(activo.censo)}</span>
						{/if}
					</div>
				{/if}
			</div>

			<ul class="leyenda">
				{#each escala.leyenda as label, i (label)}
					<li>
						<span class="leyenda-swatch" style="background:{RAMPA[i]}"></span>
						{label}
					</li>
				{/each}
			</ul>

			<p class="nota">
				Participación por municipio{#if corteActivo}
					— {corteActivo.etiqueta.toLowerCase()}{corteActivo.hora !== 'Cierre' ? ` (${corteActivo.hora})` : ''}
				{/if} — en blanco, los que todavía no tienen dato de ese corte
			</p>
		{/if}
	</div>
</section>

<style>
	.panel {
		background: #fff;
		border: 1px solid #e5e7eb;
		min-width: 0;
	}

	.kicker {
		margin: 0;
		padding: 7px 0;
		background: #fafafa;
		border-bottom: 1px solid #f0f0f0;
		border-left: 3px solid var(--c, #01f3b3);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #9ca3af;
		text-align: center;
	}

	.panel-body {
		padding: 20px;
		min-width: 0;
	}

	.wrap {
		position: relative;
	}

	.mapa {
		display: block;
		width: 100%;
		max-width: 420px;
		height: auto;
		margin: 0 auto;
	}

	.muni:hover {
		stroke: var(--ink, #0a0e14);
		stroke-width: 1;
	}

	.loading {
		margin: 0;
		padding: 28px 0;
		text-align: center;
		color: #9ca3af;
		font-size: 11px;
	}

	.leyenda {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 12px;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
		font-size: 10px;
		color: #6b7280;
	}

	.leyenda li {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.leyenda-swatch {
		width: 11px;
		height: 11px;
		/* Filete neutro: los tramos claros de la rampa se pierden contra el papel
		   en una marca de 11px. Mismo criterio que pide el AGENTS.md para los
		   colores claros del catálogo de partidos. */
		border: 1px solid #e5e7eb;
	}

	.nota {
		margin: 10px 0 0;
		font-size: 9.5px;
		line-height: 1.45;
		color: #9ca3af;
		text-align: center;
		font-style: italic;
	}

	.popup {
		position: fixed;
		z-index: 40;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 150px;
		padding: 8px 10px;
		background: #fff;
		border: 1px solid #e5e7eb;
		/* Sombra de sello del workspace: offset duro, sin difuminado. */
		box-shadow: var(--shadow-hard, 2px 2px 0 rgba(10, 14, 20, 0.15));
		pointer-events: none;
	}

	.popup-nombre {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink, #0a0e14);
	}

	.popup-pct {
		font-size: 15px;
		font-weight: 700;
		color: var(--ink, #0a0e14);
	}

	.popup-pendiente {
		font-size: 11px;
		font-style: italic;
		color: #9ca3af;
	}

	.popup-delta {
		font-size: 9.5px;
		font-weight: 700;
		color: #9ca3af;
	}

	.popup-delta.sube {
		color: #0a7a4a;
	}

	.popup-delta.baja {
		color: var(--stamp, #e10819);
	}

	.popup-anterior {
		font-weight: 400;
		color: #9ca3af;
	}

	.popup-censo {
		font-size: 9.5px;
		color: #9ca3af;
	}

	@media (max-width: 640px) {
		.panel-body {
			padding: 14px;
		}
	}
</style>
