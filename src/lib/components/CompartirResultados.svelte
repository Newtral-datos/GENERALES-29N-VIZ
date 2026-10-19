<script lang="ts">
	import { getResultados23j, type Nacional, type Provincia } from '#lib/data';
	import { asset } from '$app/paths';
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection as FC } from '#lib/geo';
	import logoUrl from '#lib/assets/logo-newtral.png';
	import faviconUrl from '#lib/assets/favicon.png';
	import { ESCRUTINIO_ABIERTO, ESCRUTINIO_SIMULADO } from '#lib/config';
	import { COLOR, URL_COMPARTIR, cargarImagen, dibujarTextoEspaciado, dibujarLinea, recortarCanvas } from '#lib/compartir-imagen';
	import CompartirMenu from '#lib/components/CompartirMenu.svelte';

	type Feature = GeoFeature<{ name: string; cod_prov: string }>;
	type FeatureCollection = FC<{ name: string; cod_prov: string }>;

	// Mismo criterio que MapaProvincias.svelte: Canarias se dibuja aparte en
	// una franja propia, nunca en su posición geográfica real (dejaría media
	// imagen en blanco de océano).
	const CANARIAS_CODES = new Set(['35', '38']);

	let nacional = $state<Nacional | null>(null);
	let provincias = $state<Record<string, Provincia> | null>(null);

	$effect(() => {
		getResultados23j().then((d) => {
			nacional = d.nacional;
			provincias = d.provincias;
		});
	});

	let textoCompartir = $derived(
		'Así queda el Congreso en las elecciones Generales del #29N. Sigue el resultado en directo en @Newtral: www.newtral.es/directo-resultados-elecciones-29n/'
	);

	async function generarImagenResultados(): Promise<HTMLCanvasElement> {
		if (!nacional || !provincias) throw new Error('Todavía no hay datos cargados');
		{
			const geo: FeatureCollection = await fetch(asset('data/provincias.geojson'), { cache: 'no-cache' }).then(
				(res) => res.json()
			);
			const mainFeatures = geo.features.filter((f) => !CANARIAS_CODES.has(f.properties.cod_prov));
			const canaryFeatures = geo.features.filter((f) => CANARIAS_CODES.has(f.properties.cod_prov));

			const W = 1080;
			const MAX_H = 2800;
			const lienzo = document.createElement('canvas');
			lienzo.width = W;
			lienzo.height = MAX_H;
			const ctx = lienzo.getContext('2d');
			if (!ctx) throw new Error('No se ha podido crear el lienzo');

			const margen = 64;
			const anchoContenido = W - margen * 2;

			ctx.fillStyle = COLOR.paper;
			ctx.fillRect(0, 0, W, MAX_H);
			ctx.fillStyle = COLOR.teal;
			ctx.fillRect(0, 0, W, 10);

			const logoImg = await cargarImagen(logoUrl);
			const logoW = 220;
			const logoH = logoW * (logoImg.height / logoImg.width);
			ctx.drawImage(logoImg, margen, 64, logoW, logoH);

			let y = 64 + logoH + 48;

			ctx.fillStyle = COLOR.grey;
			ctx.font = '700 15px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'alphabetic';
			// TODO: cuando el pipeline de datos traiga una hora de actualización
			// real (campo nuevo, se añadirá "con el script"), añadirla aquí
			// detrás del % de escrutinio — "GENERALES 29N — ESCRUTINIO 92,3% —
			// ACTUALIZADO 21:45". De momento no hay dato real que mostrar, así
			// que no se inventa un hueco vacío ni una hora falsa.
			const kicker = ESCRUTINIO_ABIERTO
				? `GENERALES 29N — ESCRUTINIO ${ESCRUTINIO_SIMULADO.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%`
				: 'GENERALES 29N';
			dibujarTextoEspaciado(ctx, kicker, margen, y, 2.5);

			y += 50;

			const cx = W / 2;

			// Sin insignia de candidato ni "Gana X" — esto es la home de
			// Congreso, no el simulador de pactos. Ningún partido "gobierna"
			// solo por tener más escaños, así que el titular es neutro: el
			// mismo dato en bruto que ya se ve en BarraEscanos/TablaPartidos.
			ctx.fillStyle = COLOR.ink;
			ctx.textAlign = 'center';
			const FS_TITULAR = 36;
			ctx.font = `800 ${FS_TITULAR}px "Helvetica Neue", Arial, sans-serif`;
			y = dibujarLinea(ctx, 'Composición del Congreso', cx, y, FS_TITULAR, 2);

			ctx.fillStyle = COLOR.grey;
			const FS_SUBTITULAR = 22;
			ctx.font = `500 ${FS_SUBTITULAR}px "Helvetica Neue", Arial, sans-serif`;
			y = dibujarLinea(ctx, `${nacional.totalEscanos} escaños — mayoría en ${nacional.mayoria}`, cx, y, FS_SUBTITULAR, 36);

			// Barra de escaños: mismo orden que BarraEscanos.svelte (bloque 1 a
			// la izquierda creciendo hacia el centro, bloque 2 a la derecha),
			// para que la imagen se reconozca como "la misma barra" del panel.
			const barH = 44;
			const izq = nacional.partidos.filter((p) => p.lado === 1).sort((a, b) => b.escanos - a.escanos);
			const der = nacional.partidos.filter((p) => p.lado === 2).sort((a, b) => a.escanos - b.escanos);
			ctx.fillStyle = COLOR.chip;
			ctx.fillRect(margen, y, anchoContenido, barH);
			let bx = margen;
			for (const p of [...izq, ...der]) {
				const segW = (p.escanos / nacional.totalEscanos) * anchoContenido;
				ctx.fillStyle = p.color;
				ctx.fillRect(bx, y, segW, barH);
				bx += segW;
			}

			const mx = margen + (nacional.mayoria / nacional.totalEscanos) * anchoContenido;
			ctx.strokeStyle = COLOR.ink;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(mx, y - 10);
			ctx.lineTo(mx, y + barH + 10);
			ctx.stroke();
			ctx.fillStyle = COLOR.ink;
			ctx.font = '700 16px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(`Mayoría (${nacional.mayoria})`, mx, y - 18);

			y += barH + 56;

			// Tabla completa — mismas columnas que TablaPartidos.svelte
			// (Partido / Votos / % / Escaños / Dif.), no la versión recortada
			// de antes: esto es la home de Congreso, no un resumen aparte.
			const partidosOrdenados = [...nacional.partidos].sort((a, b) => b.escanos - a.escanos);
			const xPartido = margen;
			const xVotos = margen + anchoContenido * 0.46;
			const xPct = margen + anchoContenido * 0.62;
			const xEscanos = margen + anchoContenido * 0.78;
			const xDif = margen + anchoContenido;
			const filaH = 38;

			ctx.fillStyle = COLOR.grey;
			ctx.font = '700 12px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText('PARTIDO', xPartido, y + 14);
			ctx.textAlign = 'right';
			ctx.fillText('VOTOS', xVotos, y + 14);
			ctx.fillText('%', xPct, y + 14);
			ctx.fillText('ESCAÑOS', xEscanos, y + 14);
			ctx.fillText('DIF.', xDif, y + 14);

			y += 26;
			ctx.strokeStyle = COLOR.rule;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(margen, y);
			ctx.lineTo(W - margen, y);
			ctx.stroke();

			y += 10;

			for (const p of partidosOrdenados) {
				const dif = p.escanosAnterior === null ? null : p.escanos - p.escanosAnterior;
				const fy = y + 24;

				ctx.fillStyle = p.color;
				ctx.fillRect(xPartido, y + 6, 12, 12);

				ctx.fillStyle = COLOR.ink;
				ctx.font = '600 17px "Helvetica Neue", Arial, sans-serif';
				ctx.textAlign = 'left';
				ctx.fillText(p.siglas, xPartido + 20, fy);

				ctx.fillStyle = COLOR.grey;
				ctx.font = '500 15px ui-monospace, "SF Mono", Menlo, monospace';
				ctx.textAlign = 'right';
				ctx.fillText(p.votos.toLocaleString('es-ES'), xVotos, fy);
				ctx.fillText(`${p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%`, xPct, fy);

				ctx.fillStyle = COLOR.ink;
				ctx.font = '700 17px ui-monospace, "SF Mono", Menlo, monospace';
				ctx.fillText(String(p.escanos), xEscanos, fy);

				ctx.font = '700 15px ui-monospace, "SF Mono", Menlo, monospace';
				ctx.fillStyle = dif === null ? COLOR.grey : dif > 0 ? COLOR.ok : dif < 0 ? COLOR.down : COLOR.grey;
				ctx.fillText(dif === null ? '—' : dif > 0 ? `+${dif}` : String(dif), xDif, fy);

				y += filaH;
				ctx.strokeStyle = COLOR.rule;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(margen, y);
				ctx.lineTo(W - margen, y);
				ctx.stroke();
			}

			y += 44;

			// Mapa de provincias — misma proyección y recorte de Canarias que
			// MapaProvincias.svelte (ver #lib/geo), reutilizado tal cual: los
			// `d` de SVG que genera featurePaths son válidos como Path2D en
			// canvas, así que no hace falta reimplementar la proyección.
			ctx.fillStyle = COLOR.ink;
			ctx.textAlign = 'center';
			const FS_MAPA_TITULO = 22;
			ctx.font = `700 ${FS_MAPA_TITULO}px "Helvetica Neue", Arial, sans-serif`;
			y = dibujarLinea(ctx, 'Partido ganador por circunscripción', cx, y, FS_MAPA_TITULO, 30);

			const mapSize = 620;
			const INSET_W = mapSize * 0.3;
			const INSET_H = mapSize * 0.18;
			const INSET_X = mapSize * 0.04;
			const INSET_GAP = mapSize * 0.035;

			const mainBounds = computeBounds(mainFeatures);
			const mainVp = mainBounds ? fitBox(mainBounds, mapSize, mapSize) : { w: mapSize, h: mapSize };
			const canaryBounds = computeBounds(canaryFeatures);
			const canaryFit = canaryBounds ? fitBox(canaryBounds, INSET_W, INSET_H) : { w: 0, h: 0 };
			const insetY = mainVp.h + INSET_GAP;
			const totalMapH = mainVp.h + INSET_GAP + INSET_H;
			const canaryOffset = {
				x: INSET_X + (INSET_W - canaryFit.w) / 2,
				y: insetY + (INSET_H - canaryFit.h) / 2
			};

			const colorForProv = (cod: string) => provincias?.[cod]?.ganador.color ?? COLOR.chip;

			ctx.save();
			ctx.translate(cx - mainVp.w / 2, y);
			for (const f of mainFeatures) {
				for (const d of featurePaths(f, mainBounds!, mainVp.w, mainVp.h)) {
					const path = new Path2D(d);
					ctx.fillStyle = colorForProv(f.properties.cod_prov);
					ctx.fill(path);
					ctx.strokeStyle = '#d8d8d8';
					ctx.lineWidth = 0.6;
					ctx.stroke(path);
				}
			}
			if (canaryBounds) {
				for (const f of canaryFeatures) {
					for (const d of featurePaths(f, canaryBounds, canaryFit.w, canaryFit.h, canaryOffset.x, canaryOffset.y)) {
						const path = new Path2D(d);
						ctx.fillStyle = colorForProv(f.properties.cod_prov);
						ctx.fill(path);
						ctx.strokeStyle = '#d8d8d8';
						ctx.lineWidth = 0.6;
						ctx.stroke(path);
					}
				}
			}
			ctx.restore();

			y += totalMapH + 36;

			ctx.strokeStyle = COLOR.rule;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(margen, y);
			ctx.lineTo(W - margen, y);
			ctx.stroke();

			y += 42;

			// Favicon de Newtral (la "N" en negro/teal) pegado al texto, como
			// pequeña firma junto a la llamada a la acción.
			const favImg = await cargarImagen(faviconUrl);
			const FS_PIE1 = 24;
			ctx.font = `600 ${FS_PIE1}px "Helvetica Neue", Arial, sans-serif`;
			const textoPie1 = 'Sigue el resultado en directo en';
			const favSize = 22;
			const favGap = 8;
			const anchoPie1 = ctx.measureText(textoPie1).width;
			const xPie1 = cx - (favSize + favGap + anchoPie1) / 2;
			ctx.drawImage(favImg, xPie1, y + 1, favSize, favSize);
			ctx.fillStyle = COLOR.grey;
			ctx.textAlign = 'left';
			ctx.fillText(textoPie1, xPie1 + favSize + favGap, y + FS_PIE1 * 0.78);
			ctx.textAlign = 'center';
			y += FS_PIE1 * 1.0 + 6;

			ctx.fillStyle = COLOR.tealDark;
			const FS_PIE2 = 26;
			ctx.font = `700 ${FS_PIE2}px "Helvetica Neue", Arial, sans-serif`;
			y = dibujarLinea(ctx, URL_COMPARTIR.replace(/^https?:\/\//, ''), cx, y, FS_PIE2, 40);

			return recortarCanvas(lienzo, W, y);
		}
	}
</script>

{#if nacional && provincias}
	<CompartirMenu
		generar={generarImagenResultados}
		nombreArchivo="resultados-generales29n.png"
		texto={textoCompartir}
		etiqueta="Compartir resultados"
		variante="discreta"
	/>
{/if}
