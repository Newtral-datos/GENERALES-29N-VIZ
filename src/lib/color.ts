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

const PAPEL = '#fafaf9';
const CONTRASTE_TEXTO = 4.5;

/** Contraste WCAG entre dos colores. */
function contraste(a: string, b: string) {
	const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
}

/**
 * El color de un partido, oscurecido lo justo para poder escribir **texto** con
 * él sobre el papel del panel.
 *
 * `tintaSobre` resuelve el caso contrario: qué tinta va encima de un color de
 * partido. Esto hace falta cuando el nombre del partido se escribe en su propio
 * color, y es un problema distinto y peor: un texto de 14 px tiene mucha menos
 * superficie que un relleno. Medido sobre el catálogo del 29N, **11 de 19
 * colores no llegan a 4,5:1 contra el papel** — CCa se queda en 1,45:1, ERC en
 * 1,71:1 y VOX en 2,33:1, o sea ilegibles.
 *
 * Se oscurece multiplicando los tres canales por el mismo factor, que baja la
 * luminancia conservando el tono: el PSOE sigue siendo rojo y VOX verde, solo
 * que en una versión que se puede leer. No se toca el color del catálogo, que
 * es el que llevan los rellenos y las marcas de color — esto es solo para
 * tinta.
 */
export function tintaDeMarca(color: string | null | undefined): string {
	if (!color) return TINTA_OSCURA;
	const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
	if (!m) return TINTA_OSCURA;
	const n = parseInt(m[1], 16);
	const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];

	let factor = 1;
	let hex = color;
	// 20 pasos del 5 % bastan para llegar a casi negro; si un color no cumpliera
	// ni así, el último paso ya contrasta de sobra.
	for (let i = 0; i < 20; i++) {
		hex =
			'#' +
			rgb
				.map((c) =>
					Math.round(c * factor)
						.toString(16)
						.padStart(2, '0')
				)
				.join('');
		if (contraste(hex, PAPEL) >= CONTRASTE_TEXTO) return hex;
		factor -= 0.05;
	}
	return TINTA_OSCURA;
}
