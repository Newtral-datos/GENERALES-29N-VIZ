<script lang="ts">
	import { asset } from '$app/paths';
	import { getResultadosSenado23j, type ProvinciaSenado } from '#lib/data';

	type Geometry = { type: string; coordinates: unknown };
	type Feature = { type: 'Feature'; properties: { name: string; cod_prov: string }; geometry: Geometry };
	type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] };
	type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number; cosLat: number };

	// Las Palmas (35) y Santa Cruz de Tenerife (38) se dibujan aparte: su posición
	// geográfica real deja un hueco enorme de océano entre ellas y la Península.
	const CANARIAS_CODES = new Set(['35', '38']);

	let allFeatures = $state<Feature[] | null>(null);
	let provincias = $state<Record<string, ProvinciaSenado> | null>(null);

	$effect(() => {
		fetch(asset('data/provincias.geojson'), { cache: 'no-cache' })
			.then((res) => res.json())
			.then((d: FeatureCollection) => {
				allFeatures = d.features;
			});
	});

	$effect(() => {
		getResultadosSenado23j().then((d) => {
			provincias = d.provincias;
		});
	});

	// Empate real a escaños entre dos o más partidos (p. ej. Cáceres 23J,
	// 2-2 PP/PSOE): "ganador" se queda con un color arbitrario del primero
	// que encuentra, así que la pintamos gris con rayado en vez de como si
	// tuviera un ganador claro.
	function empateFor(codProv: string): boolean {
		const p = provincias?.[codProv];
		if (!p) return false;
		const max = Math.max(...p.composicion.map((c) => c.escanos));
		return p.composicion.filter((c) => c.escanos === max).length > 1;
	}

	function colorFor(codProv: string): string {
		if (empateFor(codProv)) return '#9AA0A6';
		return provincias?.[codProv]?.ganador.color ?? 'var(--paper)';
	}

	// Popup con el reparto de senadores de la provincia bajo el cursor (y, si
	// tiene varias circunscripciones — Baleares, Canarias —, el detalle de cada una).
	let activeCod = $state<string | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	const POPUP_W = 200;
	const POPUP_H = 160;

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

	function computeBounds(feats: Feature[]): Bounds | null {
		if (!feats.length) return null;
		let minLng = Infinity,
			maxLng = -Infinity,
			minLat = Infinity,
			maxLat = -Infinity;

		const walk = (coords: unknown): void => {
			if (!Array.isArray(coords)) return;
			if (typeof coords[0] === 'number') {
				const [lng, lat] = coords as [number, number];
				if (lng < minLng) minLng = lng;
				if (lng > maxLng) maxLng = lng;
				if (lat < minLat) minLat = lat;
				if (lat > maxLat) maxLat = lat;
			} else {
				(coords as unknown[]).forEach(walk);
			}
		};
		feats.forEach((f) => walk(f.geometry.coordinates));

		const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
		return { minLng, maxLng, minLat, maxLat, cosLat };
	}

	function fitBox(bounds: Bounds, maxW: number, maxH: number) {
		const lngRange = (bounds.maxLng - bounds.minLng) * bounds.cosLat;
		const latRange = bounds.maxLat - bounds.minLat;
		return lngRange / latRange > maxW / maxH
			? { w: maxW, h: maxW * (latRange / lngRange) }
			: { w: maxH * (lngRange / latRange), h: maxH };
	}

	function project(bounds: Bounds, w: number, h: number, lng: number, lat: number): [number, number] {
		const { minLng, maxLng, minLat, maxLat, cosLat } = bounds;
		const x = (((lng - minLng) * cosLat) / ((maxLng - minLng) * cosLat || 1)) * w;
		const y = h - ((lat - minLat) / (maxLat - minLat || 1)) * h;
		return [x, y];
	}

	function featurePaths(f: Feature, bounds: Bounds, w: number, h: number, offX = 0, offY = 0): string[] {
		const ringPath = (ring: [number, number][]): string => {
			if (!ring.length) return '';
			const [sx, sy] = project(bounds, w, h, ring[0][0], ring[0][1]);
			let d = `M${sx + offX},${sy + offY}`;
			for (let i = 1; i < ring.length; i++) {
				const [x, y] = project(bounds, w, h, ring[i][0], ring[i][1]);
				d += `L${x + offX},${y + offY}`;
			}
			return d + 'Z';
		};

		const { type, coordinates } = f.geometry;
		if (type === 'Polygon') return [ringPath((coordinates as [number, number][][])[0])];
		if (type === 'MultiPolygon') {
			return (coordinates as [number, number][][][]).map((poly) => ringPath(poly[0]));
		}
		return [];
	}

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
					<defs>
						<pattern id="hatch-senado" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
							<rect width="4" height="4" fill="transparent" />
							<line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.75)" stroke-width="1.1" />
						</pattern>
					</defs>

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
							{#if empateFor(f.properties.cod_prov)}
								<path {d} fill="url(#hatch-senado)" pointer-events="none" />
							{/if}
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
								{#if empateFor(f.properties.cod_prov)}
									<path {d} fill="url(#hatch-senado)" pointer-events="none" />
								{/if}
							{/each}
						{/each}
					{/if}
				</svg>
				<p class="nota">
				Senadores de elección directa por provincia — 23J — pasa el ratón para ver el detalle. Rayado = empate a
				escaños entre partidos.
			</p>
			</div>
		{/if}
	</div>
</div>

{#if activeProvincia}
	<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
		<p class="popup-title">
			{activeProvincia.nombre}{#if activeCod && empateFor(activeCod)}<span class="popup-empate"> — empate</span>{/if}
		</p>
		<table class="popup-table">
			<tbody>
				{#each activeProvincia.composicion as p (p.siglas)}
					<tr>
						<td class="popup-party">
							<span class="swatch" style="background:{p.color}"></span>
							{p.siglas}
						</td>
						<td class="popup-num">{p.escanos}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if activeProvincia.circunscripciones.length > 1}
			<p class="popup-sub">Por circunscripción:</p>
			<table class="popup-table">
				<tbody>
					{#each activeProvincia.circunscripciones as c (c.nombre)}
						<tr>
							<td class="popup-party">{c.nombre}</td>
							<td class="popup-num">
								{c.ganadores.map((g) => g.siglas).join(', ')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
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
		width: 200px;
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

	.popup-empate {
		color: var(--stamp);
	}

	.popup-sub {
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--grey);
		margin: 8px 0 4px 0;
		padding-top: 6px;
		border-top: 1px solid var(--border);
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
