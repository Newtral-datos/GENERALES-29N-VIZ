<script lang="ts">
	import { CONVOCATORIA } from '#lib/config';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection } from '#lib/geo';
	import { fillDe, etiquetaDe, GRIS_SIN_DATOS } from '#lib/empates';
	import PatronesEmpate from '#lib/components/PatronesEmpate.svelte';
	import { assetDinamico, getResultadosMunicipios, type ResultadoMunicipio } from '#lib/data';

	type MuniProps = { NATCODE: string; NAMEUNIT: string; cod_prov: string };
	type Feature = GeoFeature<MuniProps>;

	export type MunicipioSeleccionado = { natcode: string; nombre: string; resultado: ResultadoMunicipio | null };

	let {
		cod,
		seleccionado = $bindable(null)
	}: { cod: string; seleccionado?: MunicipioSeleccionado | null } = $props();

	let features = $state<Feature[] | null>(null);
	let resultados = $state<Record<string, ResultadoMunicipio> | null>(null);
	let loadedCod = $state<string | null>(null);
	let inicializadoDesdeUrl = false;

	$effect(() => {
		const codActual = cod;
		features = null;
		resultados = null;
		seleccionado = null;
		inicializadoDesdeUrl = false;
		fetch(assetDinamico(`data/municipios/${codActual}.geojson`), { cache: 'no-cache' })
			.then((res) => res.json())
			.then((d: FeatureCollection<MuniProps>) => {
				features = d.features;
			});
		getResultadosMunicipios(codActual).then((d) => {
			resultados = d;
			loadedCod = codActual;
		});
	});

	function codIne(natcode: string): string {
		return natcode.slice(-5);
	}

	function resultadoFor(natcode: string): ResultadoMunicipio | null {
		return resultados?.[codIne(natcode)] ?? null;
	}

	// `principales[0]` era el primero al ordenar, que con 0 votos escrutados no
	// es un ganador. Ahora el estado lo marca el pipeline (ver #lib/empates):
	// gris liso sin escrutar y color del más votado en el resto. Los empates son
	// reales en municipios pequeños y se declaran en el popup, no en el relleno
	// (ver RAYADO_EMPATES en #lib/empates).
	// Sin un solo resultado —antes de que empiece el escrutinio, o si falla la
	// petición de esa provincia— la provincia entera va al gris de "sin
	// escrutar", igual que el mapa de territorios. En blanco parece que el mapa
	// está roto, y a las 20:00 del 29N es exactamente lo que pasa.
	//
	// Es distinto de que falte UN municipio habiendo datos de los demás: eso sí
	// es papel, porque ahí el hueco es del municipio y no del escrutinio.
	let sinResultados = $derived(!resultados || Object.keys(resultados).length === 0);

	function colorFor(natcode: string): string {
		if (sinResultados) return GRIS_SIN_DATOS;
		const r = resultadoFor(natcode);
		if (!r) return 'var(--paper)';
		return fillDe(r.ganador ?? null);
	}

	let ganadores = $derived(Object.values(resultados ?? {}).map((r) => r.ganador));

	// Si la URL ya trae ?muni=<ine>, preseleccionamos ese municipio al cargar.
	// Hay que esperar a que lleguen TANTO la geometría como los resultados:
	// si se resuelve en cuanto llega la geometría (que normalmente va primero),
	// el resultado se congela en null aunque los datos lleguen justo después.
	$effect(() => {
		if (inicializadoDesdeUrl || !features || !resultados) return;
		const ine = page.url.searchParams.get('muni');
		const match = ine ? features.find((f) => f.properties.NATCODE.endsWith(ine)) : null;
		if (match) {
			seleccionado = { natcode: match.properties.NATCODE, nombre: match.properties.NAMEUNIT, resultado: resultadoFor(match.properties.NATCODE) };
		}
		inicializadoDesdeUrl = true;
	});

	function syncUrlMuni(ine: string | null) {
		if (page.url.searchParams.get('muni') === ine) return;
		const params = new URLSearchParams(page.url.searchParams.toString());
		if (ine) {
			params.set('muni', ine);
		} else {
			params.delete('muni');
		}
		replaceState(`${page.url.pathname}?${params.toString()}`, page.state);
	}

	function onMuniClick(f: Feature) {
		seleccionado =
			seleccionado?.natcode === f.properties.NATCODE
				? null
				: { natcode: f.properties.NATCODE, nombre: f.properties.NAMEUNIT, resultado: resultadoFor(f.properties.NATCODE) };
		syncUrlMuni(seleccionado ? codIne(seleccionado.natcode) : null);
	}

	let activeIdx = $state<number | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	const POPUP_W = 170;

	function setPopupPos(x: number, y: number) {
		popupPos = {
			x: Math.min(Math.max(x + 12, 8), (typeof window !== 'undefined' ? window.innerWidth : 0) - POPUP_W - 8),
			y: y + 12
		};
	}

	function onMuniEnter(e: MouseEvent, idx: number) {
		activeIdx = idx;
		setPopupPos(e.clientX, e.clientY);
	}

	function onMuniMove(e: MouseEvent) {
		setPopupPos(e.clientX, e.clientY);
	}

	function onMuniLeave() {
		activeIdx = null;
	}

	let activeMuni = $derived(activeIdx !== null && features ? features[activeIdx] : null);
	let activeResultado = $derived(activeMuni ? resultadoFor(activeMuni.properties.NATCODE) : null);

	const SIZE = 360;

	let bounds = $derived(features && features.length ? computeBounds(features) : null);
	let vp = $derived(bounds ? fitBox(bounds, SIZE, SIZE) : { w: SIZE, h: SIZE });

	let mostrando = $derived(features && loadedCod === cod && resultados ? features : null);
</script>

<div class="panel">
	{#if !mostrando}
		<p class="loading">Cargando municipios…</p>
	{:else if !mostrando.length}
		<p class="loading">Sin geometría municipal disponible para esta provincia.</p>
	{:else}
		<div class="wrap">
			<svg viewBox="0 0 {vp.w} {vp.h}" class="mapa">
				<defs>
					<PatronesEmpate {ganadores} />
				</defs>
				{#each mostrando as f, idx (f.properties.NATCODE)}
					{#each featurePaths(f, bounds!, vp.w, vp.h) as d, i (i)}
						<path
							{d}
							fill={colorFor(f.properties.NATCODE)}
							stroke={seleccionado?.natcode === f.properties.NATCODE ? 'var(--ink)' : '#d8d8d8'}
							stroke-width={seleccionado?.natcode === f.properties.NATCODE ? 1.5 : 0.5}
							class="muni"
							role="img"
							aria-label={f.properties.NAMEUNIT}
							onmouseenter={(e) => onMuniEnter(e, idx)}
							onmousemove={onMuniMove}
							onmouseleave={onMuniLeave}
							onclick={() => onMuniClick(f)}
						/>
					{/each}
				{/each}
			</svg>
			<p class="nota">
				Partido ganador por municipio — {CONVOCATORIA} — pasa el ratón para un vistazo, haz clic para el
				detalle completo. Gris = sin escrutar; en un empate se pinta el color del más
				votado y el popup lo indica
			</p>
		</div>
	{/if}
</div>

{#if activeMuni}
	<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
		<p class="popup-title">{activeMuni.properties.NAMEUNIT}</p>
		<!-- El escrutinio del municipio, debajo del nombre: sin él los
		     porcentajes de abajo no se pueden interpretar. El Ministerio cierra
		     mesa a mesa, así que un municipio puede ir al 20 % con su provincia
		     al 70 %, y un "PP 48,1 %" significa cosas muy distintas en cada
		     caso. Va en el popup y no en el relleno del mapa porque el color ya
		     codifica al ganador. -->
		{#if activeResultado?.pctEscrutado != null}
			<p class="popup-escrutado">
				{activeResultado.pctEscrutado.toLocaleString('es-ES', {
					maximumFractionDigits: 1
				})}% escrutado
			</p>
		{/if}
		{#if activeResultado}
			{#each activeResultado.principales.slice(0, 3) as p (p.siglas)}
				<div class="popup-row">
					<span class="swatch" style="background:{p.color}"></span>
					<span class="popup-siglas">{p.siglas}</span>
					<span class="popup-pct">{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%</span>
				</div>
			{/each}
		{:else}
			<p class="popup-sin-datos">Sin datos</p>
		{/if}
	</div>
{/if}

<style>
	.panel {
		width: 100%;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
		text-align: center;
	}

	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.mapa {
		width: 100%;
		max-width: 320px;
	}

	.muni {
		cursor: pointer;
	}

	.muni:hover {
		filter: brightness(0.92);
	}

	.nota {
		font-size: 9px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 6px 0 0 0;
		text-align: center;
	}

	.popup {
		position: fixed;
		z-index: 60;
		background: var(--paper);
		border: 1px solid var(--ink);
		padding: 6px 10px;
		box-shadow: var(--shadow-hard);
		pointer-events: none;
	}

	.popup-title {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--ink);
		margin: 0 0 4px 0;
		white-space: nowrap;
	}

	/* Recesivo y en una línea: es contexto para leer las cifras de abajo, no
	   una cifra más. Por eso no lleva el tratamiento de dato (mono, grande). */
	.popup-escrutado {
		font-family: var(--font-body);
		font-size: 9px;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--grey);
		margin: -2px 0 5px 0;
		white-space: nowrap;
	}

	.popup-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.swatch {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
	}

	.popup-siglas {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
	}

	.popup-pct {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--grey);
		font-variant-numeric: tabular-nums;
	}

	.popup-sin-datos {
		font-family: var(--font-body);
		font-size: 10px;
		font-style: italic;
		color: var(--grey);
		margin: 0;
	}
</style>
