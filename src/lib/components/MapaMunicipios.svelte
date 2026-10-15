<script lang="ts">
	import { page } from '$app/state';
	import { asset } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection } from '#lib/geo';
	import { getResultadosMunicipios, type ResultadoMunicipio } from '#lib/data';

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
		fetch(asset(`data/municipios/${codActual}.geojson`), { cache: 'no-cache' })
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

	function colorFor(natcode: string): string {
		return resultadoFor(natcode)?.principales[0]?.color ?? 'var(--paper)';
	}

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
		const params = new URLSearchParams(page.url.searchParams);
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
			<p class="nota">Partido ganador por municipio — 23J — pasa el ratón para un vistazo, haz clic para el detalle completo</p>
		</div>
	{/if}
</div>

{#if activeMuni}
	<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
		<p class="popup-title">{activeMuni.properties.NAMEUNIT}</p>
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
