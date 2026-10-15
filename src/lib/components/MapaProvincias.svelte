<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { getResultados23j, type Provincia } from '#lib/data';
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection as FC } from '#lib/geo';

	type Feature = GeoFeature<{ name: string; cod_prov: string }>;
	type FeatureCollection = FC<{ name: string; cod_prov: string }>;

	// Las Palmas (35) y Santa Cruz de Tenerife (38) se dibujan aparte: su posición
	// geográfica real deja un hueco enorme de océano entre ellas y la Península.
	const CANARIAS_CODES = new Set(['35', '38']);

	let allFeatures = $state<Feature[] | null>(null);
	let provincias = $state<Record<string, Provincia> | null>(null);

	$effect(() => {
		fetch(asset('data/provincias.geojson'), { cache: 'force-cache' })
			.then((res) => res.json())
			.then((d: FeatureCollection) => {
				allFeatures = d.features;
			});
	});

	$effect(() => {
		getResultados23j().then((d) => {
			provincias = d.provincias;
		});
	});

	function colorFor(codProv: string): string {
		return provincias?.[codProv]?.ganador.color ?? 'var(--paper)';
	}

	// Popup con las tres primeras fuerzas de la provincia bajo el cursor.
	let activeCod = $state<string | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	const POPUP_W = 190;
	const POPUP_H = 150;

	function setPopupPos(x: number, y: number) {
		popupPos = {
			x: Math.min(Math.max(x + 12, 8), window.innerWidth - POPUP_W - 8),
			y: Math.min(Math.max(y + 12, 8), window.innerHeight - POPUP_H - 8)
		};
	}

	function onProvinceEnter(e: MouseEvent, codProv: string) {
		activeCod = codProv;
		setPopupPos(e.clientX, e.clientY);
	}

	function onProvinceMove(e: MouseEvent) {
		setPopupPos(e.clientX, e.clientY);
	}

	function onProvinceClick(codProv: string) {
		goto(`${resolve('/provincias')}?cod=${codProv}`);
	}

	function onProvinceLeave() {
		activeCod = null;
	}

	let activeProvincia = $derived(activeCod && provincias ? provincias[activeCod] : null);

	const SIZE = 440;
	const INSET_W = SIZE * 0.3;
	const INSET_H = SIZE * 0.18;
	const INSET_X = SIZE * 0.04;
	const INSET_GAP = SIZE * 0.035;

	let mainFeatures = $derived(allFeatures ? allFeatures.filter((f) => !CANARIAS_CODES.has(f.properties.cod_prov)) : []);
	let canaryFeatures = $derived(allFeatures ? allFeatures.filter((f) => CANARIAS_CODES.has(f.properties.cod_prov)) : []);

	let mainBounds = $derived(computeBounds(mainFeatures));
	let mainVp = $derived(mainBounds ? fitBox(mainBounds, SIZE, SIZE) : { w: SIZE, h: SIZE });

	let canaryBounds = $derived(computeBounds(canaryFeatures));
	let canaryFit = $derived(canaryBounds ? fitBox(canaryBounds, INSET_W, INSET_H) : { w: 0, h: 0 });
	// La franja de Canarias va pegada debajo del mapa peninsular, nunca encajada
	// dentro de su contorno: España no deja hueco interior lo bastante grande.
	let insetY = $derived(mainVp.h + INSET_GAP);
	let totalH = $derived(mainVp.h + INSET_GAP + INSET_H);
	let canaryOffset = $derived({
		x: INSET_X + (INSET_W - canaryFit.w) / 2,
		y: insetY + (INSET_H - canaryFit.h) / 2
	});
</script>

<div class="panel">
	<p class="kicker">Resultados por provincia</p>

	<div class="panel-body">
		{#if !allFeatures || !provincias}
			<p class="loading">Cargando mapa…</p>
		{:else}
			<div class="wrap">
				<svg viewBox="0 0 {mainVp.w} {totalH}" class="mapa">
					{#each mainFeatures as f (f.properties.cod_prov)}
						{#each featurePaths(f, mainBounds!, mainVp.w, mainVp.h) as d, i (i)}
							<path
								{d}
								fill={colorFor(f.properties.cod_prov)}
								stroke="#d8d8d8"
								stroke-width="0.6"
								class="prov"
								role="img"
								aria-label={f.properties.name}
								onmouseenter={(e) => onProvinceEnter(e, f.properties.cod_prov)}
								onmousemove={onProvinceMove}
								onmouseleave={onProvinceLeave}
								onclick={() => onProvinceClick(f.properties.cod_prov)}
							/>
						{/each}
					{/each}

					{#if canaryBounds}
						<rect
							x={INSET_X}
							y={insetY}
							width={INSET_W}
							height={INSET_H}
							fill="none"
							stroke="var(--border)"
							stroke-width="0.6"
							stroke-dasharray="2,2"
						/>
						<text x={INSET_X + 3} y={insetY + 10} class="inset-label">Canarias</text>
						{#each canaryFeatures as f (f.properties.cod_prov)}
							{#each featurePaths(f, canaryBounds, canaryFit.w, canaryFit.h, canaryOffset.x, canaryOffset.y) as d, i (i)}
								<path
									{d}
									fill={colorFor(f.properties.cod_prov)}
									stroke="#d8d8d8"
									stroke-width="0.6"
									class="prov"
									role="img"
									aria-label={f.properties.name}
									onmouseenter={(e) => onProvinceEnter(e, f.properties.cod_prov)}
									onmousemove={onProvinceMove}
									onmouseleave={onProvinceLeave}
									onclick={() => onProvinceClick(f.properties.cod_prov)}
								/>
							{/each}
						{/each}
					{/if}
				</svg>
				<p class="nota">Partido ganador por circunscripción — 23J — pasa el ratón para un vistazo, haz clic para ver el detalle completo</p>
			</div>
		{/if}
	</div>
</div>

{#if activeProvincia}
	<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
		<p class="popup-title">{activeProvincia.nombre}</p>
		<table class="popup-table">
			<tbody>
				{#each activeProvincia.principales.slice(0, 3) as p (p.siglas)}
					<tr>
						<td class="popup-party">
							<span class="swatch" style="background:{p.color}"></span>
							{p.siglas}
						</td>
						<td class="popup-num">{p.escanos}</td>
						<td class="popup-num">{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

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
		margin: 0 0 8px 0;
		text-align: center;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
	}

	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.mapa {
		width: 100%;
		max-width: 400px;
	}

	.prov {
		cursor: pointer;
	}

	.prov:hover {
		filter: brightness(0.92);
	}

	.inset-label {
		font-family: var(--font-body);
		font-size: 6px;
		font-style: italic;
		fill: var(--grey);
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
		width: 190px;
		background: var(--paper);
		border: 1px solid var(--ink);
		padding: 8px 10px;
		box-shadow: var(--shadow-hard);
	}

	.popup-title {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 6px 0;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}

	.popup-table {
		width: 100%;
		border-collapse: collapse;
	}

	.popup-table td {
		padding: 2px 0;
		font-size: 11px;
	}

	.popup-party {
		display: flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-body);
		color: var(--ink);
	}

	.swatch {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
	}

	.popup-num {
		text-align: right;
		font-family: var(--font-mono);
		color: var(--grey);
		font-variant-numeric: tabular-nums;
	}
</style>
