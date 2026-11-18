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

/**
 * Los cortes se calculan con los datos del corte horario que se esté viendo, no
 * con una escala fija.
 *
 * Con cortes fijos (55/60/65/70, pensados para el cierre) el mapa del primer
 * avance salía de un solo color: a las 14:00 la participación real iba de 23 %
 * a 47 %, o sea entera dentro del tramo "< 55 %". Un mapa monocolor no dice
 * nada — y lo que hay que ver es justo dónde se vota más y menos a esa hora.
 *
 * Se usan cuantiles, así que los cinco tramos llevan aproximadamente el mismo
 * número de provincias y el mapa siempre discrimina, tanto a las 14:00 como al
 * cierre.
 *
 * **El coste hay que decirlo:** el mismo color significa cosas distintas en
 * cortes distintos, así que la leyenda tiene que mostrar los rangos reales (lo
 * hace) y no se pueden comparar a ojo dos mapas de horas distintas. A cambio,
 * cada mapa es legible por sí solo, que es lo que se mira.
 */
const TRAMOS = RAMPA.length;

export type Escala = { cortes: number[]; leyenda: string[] };

function formato(n: number): string {
	return n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

export function escalaDe(valores: (number | null | undefined)[]): Escala {
	const datos = valores.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);

	// Sin datos suficientes para repartir en tramos, una escala de respaldo: la
	// del cierre, que es la que tiene sentido cuando el reparto ya es el final.
	if (datos.length < TRAMOS) {
		const cortes = [55, 60, 65, 70];
		return { cortes, leyenda: etiquetas(cortes) };
	}

	const cortes: number[] = [];
	for (let i = 1; i < TRAMOS; i++) {
		const pos = Math.floor((datos.length * i) / TRAMOS);
		const valor = Math.round(datos[pos] * 10) / 10;
		// Sin cortes repetidos: si media España tiene el mismo valor, dos
		// tramos idénticos dejarían un color muerto en la leyenda.
		if (!cortes.includes(valor)) cortes.push(valor);
	}

	return { cortes, leyenda: etiquetas(cortes) };
}

function etiquetas(cortes: number[]): string[] {
	if (!cortes.length) return ['Todos'];
	const out = [`< ${formato(cortes[0])}%`];
	for (let i = 1; i < cortes.length; i++) {
		out.push(`${formato(cortes[i - 1])}–${formato(cortes[i])}%`);
	}
	out.push(`≥ ${formato(cortes[cortes.length - 1])}%`);
	return out;
}

/** Color del tramo que le toca a un porcentaje, según la escala que se pase. */
export function colorDePct(pct: number, escala: Escala): string {
	const i = escala.cortes.findIndex((c) => pct < c);
	return RAMPA[i === -1 ? escala.cortes.length : i];
}

/**
 * Color de un ámbito, o el papel si ese corte no tiene dato.
 *
 * `null` no es 0: un corte pendiente (el avance de las 18:00 a las 14:30) no es
 * una participación del 0 %. Pintarlo del tramo más claro lo haría pasar por
 * un dato real y malísimo.
 */
export function colorDeAmbito(pct: number | null | undefined, escala: Escala): string {
	return pct === null || pct === undefined ? 'var(--paper)' : colorDePct(pct, escala);
}
