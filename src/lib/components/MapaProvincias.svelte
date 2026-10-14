<script lang="ts">
	import { asset } from '$app/paths';

	type Geometry = { type: string; coordinates: unknown };
	type Feature = { type: 'Feature'; properties: { name: string; cod_prov: string }; geometry: Geometry };
	type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] };
	type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number; cosLat: number };

	// Las Palmas (35) y Santa Cruz de Tenerife (38) se dibujan aparte: su posición
	// geográfica real deja un hueco enorme de océano entre ellas y la Península.
	const CANARIAS_CODES = new Set(['35', '38']);

	let allFeatures = $state<Feature[] | null>(null);

	$effect(() => {
		fetch(asset('data/provincias.geojson'), { cache: 'force-cache' })
			.then((res) => res.json())
			.then((d: FeatureCollection) => {
				allFeatures = d.features;
			});
	});

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
		{#if !allFeatures}
			<p class="loading">Cargando mapa…</p>
		{:else}
			<div class="wrap">
				<svg viewBox="0 0 {mainVp.w} {totalH}" class="mapa">
					{#each mainFeatures as f (f.properties.cod_prov)}
						{#each featurePaths(f, mainBounds!, mainVp.w, mainVp.h) as d, i (i)}
							<path {d} fill="var(--paper)" stroke="var(--border)" stroke-width="0.6" />
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
								<path {d} fill="var(--paper)" stroke="var(--border)" stroke-width="0.6" />
							{/each}
						{/each}
					{/if}
				</svg>
				<p class="nota">Pendiente de resultados por circunscripción</p>
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
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 14px 0;
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
		max-width: 520px;
	}

	.inset-label {
		font-family: var(--font-body);
		font-size: 6px;
		font-style: italic;
		fill: var(--grey);
	}

	.nota {
		font-size: 10px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 10px 0 0 0;
		text-align: center;
	}
</style>
