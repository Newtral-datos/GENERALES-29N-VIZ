/**
 * La escala de color de la participación, compartida por sus dos mapas.
 *
 * Secuencial de un solo tono (el hue del teal de marca `#01f3b3`) en OKLCH, con
 * la luminosidad bajando de 0,96 a 0,39: a más participación, más oscuro. Es la
 * forma que le toca a una magnitud — un arcoíris aquí inventaría categorías
 * donde solo hay un número que sube.
 *
 * Comprobada la monotonía de luminosidad, que es el criterio de una rampa
 * secuencial (0.959 > 0.800 > 0.720 > 0.619 > 0.386). El validador de paletas
 * categóricas no aplica: en una secuencial los pasos contiguos **deben**
 * parecerse, y marcaría como fallo justo lo que se busca.
 *
 * Vive aquí y no dentro de un componente porque el mapa de provincias y el de
 * municipios están en la misma página: dos escalas distintas para la misma
 * medida harían que el mismo porcentaje saliera de dos colores a diez
 * centímetros de distancia.
 */

export const RAMPA = ['#e6f6ef', '#5dd8aa', '#00c287', '#009f66', '#005230'];

/** Cortes en valores redondos: la leyenda se lee igual aunque cambie el reparto real. */
export const CORTES = [55, 60, 65, 70];

export const LEYENDA = ['< 55%', '55–60%', '60–65%', '65–70%', '≥ 70%'];

/** Color del tramo que le toca a un porcentaje. */
export function colorDePct(pct: number): string {
	const i = CORTES.findIndex((c) => pct < c);
	return RAMPA[i === -1 ? RAMPA.length - 1 : i];
}

/**
 * Color de un ámbito, o el papel si ese corte no tiene dato.
 *
 * `null` no es 0: un corte pendiente (el avance de las 18:00 a las 14:30) no es
 * una participación del 0 %. Pintarlo del tramo más claro lo haría pasar por
 * un dato real y malísimo.
 */
export function colorDeAmbito(pct: number | null | undefined): string {
	return pct === null || pct === undefined ? 'var(--paper)' : colorDePct(pct);
}
