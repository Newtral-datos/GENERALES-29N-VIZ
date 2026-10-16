<script lang="ts">
	import { asset } from '$app/paths';
	import { getParticipacion23j, type ParticipacionProvincia } from '#lib/data';
	import { formatMiles } from '#lib/format';
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection as FC } from '#lib/geo';

	type Feature = GeoFeature<{ name: string; cod_prov: string }>;
	type FeatureCollection = FC<{ name: string; cod_prov: string }>;

	// activeIdx viene de ParticipacionView: mismo avance activo que las cajitas
	// de arriba y el ranking, para que el mapa se mueva junto con el resto del
	// bloque según avanza la jornada (-1 = todavía sin ningún avance publicado).
	let { activeIdx }: { activeIdx: number } = $props();

	// Las Palmas (35) y Santa Cruz de Tenerife (38) se dibujan aparte: su posición
	// geográfica real deja un hueco enorme de océano entre ellas y la Península.
	const CANARIAS_CODES = new Set(['35', '38']);

	let allFeatures = $state<Feature[] | null>(null);
	let provincias = $state<Record<string, ParticipacionProvincia> | null>(null);

	$effect(() => {
		fetch(asset('data/provincias.geojson'), { cache: 'no-cache' })
			.then((res) => res.json())
			.then((d: FeatureCollection) => {
				allFeatures = d.features;
			});
	});

	$effect(() => {
		getParticipacion23j().then((d) => {
			provincias = d.provincias;
		});
	});

	// Escala secuencial de un solo tono (hue del teal de marca #01f3b3) en OKLCH,
	// L de 0.96 a 0.37 — a más participación, más oscuro. Cortes en valores
	// redondos para que la leyenda se lea igual aunque cambie el reparto real.
	const RAMP = ['#e6f6ef', '#5dd8aa', '#00c287', '#009f66', '#005230'];
	const CORTES = [55, 60, 65, 70];
	const LEYENDA = ['< 55%', '55–60%', '60–65%', '65–70%', '≥ 70%'];

	function colorForPct(pct: number): string {
		const i = CORTES.findIndex((c) => pct < c);
		return RAMP[i === -1 ? RAMP.length - 1 : i];
	}

	// Valor del avance activo para una provincia; null si ese corte todavía no
	// tiene dato (antes de que se publique, o antes del primer avance de todos).
	function pctFor(p: ParticipacionProvincia): number | null {
		if (activeIdx < 0) return null;
		return p.avances[activeIdx]?.participacionPct ?? null;
	}

	function colorFor(codProv: string): string {
		const p = provincias?.[codProv];
		const pct = p ? pctFor(p) : null;
		return pct !== null ? colorForPct(pct) : 'var(--paper)';
	}

	let activeCod = $state<string | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	const POPUP_W = 170;
	const POPUP_H = 108;

	function setPopupPos(x: number, y: number) {
		const cabeHueco = window.innerWidth - x >= POPUP_W + 20;
		const left = cabeHueco ? x + 12 : x - POPUP_W - 12;
		popupPos = {
			x: Math.min(Math.max(left, 8), window.innerWidth - POPUP_W - 8),
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

	function onProvinceLeave() {
		activeCod = null;
	}

	let activeProvincia = $derived(activeCod && provincias ? provincias[activeCod] : null);

	// hora/etiqueta del avance activo son iguales en todas las provincias —
	// cogemos cualquiera para rotular el mapa.
	let avanceActivo = $derived.by(() => {
		if (activeIdx < 0 || !provincias) return null;
		return Object.values(provincias)[0]?.avances[activeIdx] ?? null;
	});

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
	let insetY = $derived(mainVp.h + INSET_GAP);
	let totalH = $derived(mainVp.h + INSET_GAP + INSET_H);
	let canaryOffset = $derived({
		x: INSET_X + (INSET_W - canaryFit.w) / 2,
		y: insetY + (INSET_H - canaryFit.h) / 2
	});
</script>

<div class="panel">
	<p class="kicker">Participación por provincia</p>

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
								/>
							{/each}
						{/each}
					{/if}
				</svg>

				<ul class="leyenda">
					{#each LEYENDA as label, i (label)}
						<li>
							<span class="leyenda-swatch" style="background:{RAMP[i]}"></span>
							{label}
						</li>
					{/each}
				</ul>

				<p class="nota">
					23J{#if avanceActivo}
						— {avanceActivo.etiqueta.toLowerCase()}{avanceActivo.hora !== 'Cierre' ? ` (${avanceActivo.hora})` : ''}
					{/if} — pasa el ratón por una provincia para ver el detalle
				</p>
			</div>
		{/if}
	</div>
</div>

{#if activeProvincia}
	{@const avance = activeIdx >= 0 ? activeProvincia.avances[activeIdx] : null}
	{@const pct = avance?.participacionPct ?? null}
	<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
		<p class="popup-title">{activeProvincia.nombre}</p>
		{#if pct !== null && avance}
			<p class="popup-pct">
				{pct.toLocaleString('es-ES', { minimumFractionDigits: 1 })}<span class="popup-pct-unit">%</span>
			</p>
			<p class="popup-sub">{formatMiles(avance.votantes!)} de {formatMiles(activeProvincia.censo)} censados — {avance.hora}</p>
			{#if avance.participacionPctAnterior !== null}
				{@const delta = Math.round((pct - avance.participacionPctAnterior) * 100) / 100}
				<p class="popup-delta" class:up={delta > 0} class:down={delta < 0}>
					{delta > 0 ? '+' : ''}{delta.toLocaleString('es-ES', { minimumFractionDigits: 1 })} pts vs {avance.hora} de 2019
				</p>
			{/if}
		{:else}
			<p class="popup-sub">Sin datos todavía</p>
		{/if}
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

	.prov:hover {
		filter: brightness(0.92);
	}

	.inset-label {
		font-family: var(--font-body);
		font-size: 6px;
		font-style: italic;
		fill: var(--grey);
	}

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
		width: 170px;
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
</style>
