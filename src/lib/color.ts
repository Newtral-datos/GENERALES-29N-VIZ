/**
 * Qué color de texto se lee encima de un color de partido.
 *
 * Los colores del catálogo no son una paleta que podamos elegir (el PP es azul
 * y el PSOE rojo), y algunos son muy claros: el verde del Frente Amplio
 * (`#CAE776`) deja el blanco en 1,35:1 contra él —medido con el validador de
 * paleta del skill `dataviz`—, así que el número de escaños escrito en blanco
 * encima del segmento, que es justo lo que hace legible una marca de color
 * flojo, no se veía. Lo mismo le pasaría al amarillo de ERC o al de CCa si
 * algún día llevan número.
 *
 * Así que la tinta se decide por el color de debajo, no a mano: luminancia
 * relativa de WCAG y, si el blanco no llega a 3:1, tinta oscura.
 */

const TINTA_CLARA = '#fff';
const TINTA_OSCURA = '#0a0e14';

function canal(v: number) {
	const c = v / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa (WCAG) de un `#rrggbb`. */
function luminancia(hex: string) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return 0;
	const n = parseInt(m[1], 16);
	return (
		0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
	);
}

/** Contraste WCAG entre el blanco y un color de fondo. */
function contrasteConBlanco(fondo: string) {
	return 1.05 / (luminancia(fondo) + 0.05);
}

/** Tinta legible sobre un color de fondo: blanca si contrasta, oscura si no. */
export function tintaSobre(fondo: string | null | undefined): string {
	if (!fondo) return TINTA_CLARA;
	return contrasteConBlanco(fondo) >= 3 ? TINTA_CLARA : TINTA_OSCURA;
}
