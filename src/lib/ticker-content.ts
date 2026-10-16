// Contenido del ticker "Última hora" (TickerUltimaHora.svelte).

import type { Nacional, Participacion23J } from '#lib/data';

// Antes de la jornada (ESCRUTINIO_ABIERTO = false): frases fijas, no hay
// resultados reales que mostrar todavía — nada que parezca un dato en vivo.
export const TITULARES_ANTES: string[] = [
	'La jornada electoral es el <b>29 de noviembre</b>',
	'Los colegios electorales abren a las <b>09:00</b> y cierran a las <b>20:00</b>',
	'Los resultados se actualizarán con cada avance oficial del Ministerio del Interior',
	'Consulta cómo votó tu municipio en <b>2023</b>',
	'Este panel se activará en directo la noche del 29N'
];

function formatoPct(n: number): string {
	return n.toLocaleString('es-ES', { minimumFractionDigits: 2 });
}

function formatoDelta(n: number): string {
	const v = Math.round(n * 100) / 100;
	return `${v > 0 ? '+' : ''}${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
}

// Último avance con dato real a nivel nacional (null si todavía no se ha
// publicado ninguno) — mismo criterio que AvancesParticipacion.svelte.
function avanceActivo(participacion: Participacion23J) {
	let idx = -1;
	participacion.nacional.avances.forEach((a, i) => {
		if (a.participacionPct !== null) idx = i;
	});
	return idx;
}

// Noche electoral (ESCRUTINIO_ABIERTO = true): titulares calculados a partir
// de los datos reales ya cargados en el panel (resultados23j.json +
// participacion23j.json), no texto escrito a mano. Solo se generan los que
// de verdad se pueden derivar con garantías de los datos disponibles.
export function generarTitularesDirecto(nacional: Nacional, participacion: Participacion23J): string[] {
	const titulares: string[] = [];

	// 1. Partido más votado en escaños.
	const lider = [...nacional.partidos].sort((a, b) => b.escanos - a.escanos)[0];
	if (lider) {
		titulares.push(`<b>${lider.siglas}</b> lidera con ${lider.escanos} escaños`);
	}

	// 2. Participación nacional en el último avance publicado, vs el mismo
	// corte de la convocatoria anterior.
	const idxAvance = avanceActivo(participacion);
	const avance = idxAvance >= 0 ? participacion.nacional.avances[idxAvance] : null;
	if (avance && avance.participacionPct !== null && avance.participacionPctAnterior !== null) {
		const delta = avance.participacionPct - avance.participacionPctAnterior;
		const momento = avance.hora === 'Cierre' ? 'al <b>cierre</b>' : `a las <b>${avance.hora}</b>`;
		titulares.push(`Participación ${momento}: ${formatoPct(avance.participacionPct)}%, ${formatoDelta(delta)} pts que en 2019`);
	}

	// 3. Mayor vuelco de escaños respecto a 2019 (solo partidos con
	// continuidad de marca verificada — ver data.ts).
	const conSwing = nacional.partidos
		.filter((p): p is typeof p & { escanosAnterior: number } => p.escanosAnterior !== null)
		.map((p) => ({ siglas: p.siglas, dif: p.escanos - p.escanosAnterior }))
		.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
	const mayorSwing = conSwing[0];
	if (mayorSwing && mayorSwing.dif !== 0) {
		const verbo = mayorSwing.dif > 0 ? 'gana' : 'pierde';
		titulares.push(`<b>${mayorSwing.siglas}</b> ${verbo} ${Math.abs(mayorSwing.dif)} escaños respecto a 2019`);
	}

	// 4. Provincia con mayor participación en el avance activo.
	if (idxAvance >= 0) {
		const provs = Object.values(participacion.provincias)
			.map((p) => ({ nombre: p.nombre, pct: p.avances[idxAvance]?.participacionPct ?? null }))
			.filter((p): p is { nombre: string; pct: number } => p.pct !== null)
			.sort((a, b) => b.pct - a.pct);
		if (provs[0]) {
			titulares.push(`<b>${provs[0].nombre}</b> registra la mayor participación: ${formatoPct(provs[0].pct)}%`);
		}
	}

	// 5. Abstención nacional en el avance activo, vs 2019.
	if (avance && avance.participacionPct !== null && avance.participacionPctAnterior !== null) {
		const abstencion = 100 - avance.participacionPct;
		const abstencionAnterior = 100 - avance.participacionPctAnterior;
		const comparativa = abstencion > abstencionAnterior ? 'por encima' : 'por debajo';
		titulares.push(`La abstención se sitúa en <b>${formatoPct(abstencion)}%</b>, ${comparativa} de 2019 (${formatoPct(abstencionAnterior)}%)`);
	}

	return titulares;
}
