export type Geometry = { type: string; coordinates: unknown };
export type GeoFeature<P = Record<string, unknown>> = { type: 'Feature'; properties: P; geometry: Geometry };
export type FeatureCollection<P = Record<string, unknown>> = { type: 'FeatureCollection'; features: GeoFeature<P>[] };
export type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number; cosLat: number };

export function computeBounds(feats: GeoFeature[]): Bounds | null {
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

export function fitBox(bounds: Bounds, maxW: number, maxH: number) {
	const lngRange = (bounds.maxLng - bounds.minLng) * bounds.cosLat;
	const latRange = bounds.maxLat - bounds.minLat;
	return lngRange / latRange > maxW / maxH
		? { w: maxW, h: maxW * (latRange / lngRange) }
		: { w: maxH * (lngRange / latRange), h: maxH };
}

export function project(bounds: Bounds, w: number, h: number, lng: number, lat: number): [number, number] {
	const { minLng, maxLng, minLat, maxLat, cosLat } = bounds;
	const x = (((lng - minLng) * cosLat) / ((maxLng - minLng) * cosLat || 1)) * w;
	const y = h - ((lat - minLat) / (maxLat - minLat || 1)) * h;
	return [x, y];
}

export function featurePaths(f: GeoFeature, bounds: Bounds, w: number, h: number, offX = 0, offY = 0): string[] {
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
