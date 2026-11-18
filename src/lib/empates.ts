/**
 * Cómo se pinta un ámbito según quién va ganando — y si de verdad va ganando.
 *
 * El pipeline marca tres estados en `ganador.estado` (ver
 * `_comun_29n.ganador_de`), porque "nadie va por delante todavía" y "van
 * empatados" se parecen en los números y no significan lo mismo:
 *
 * - `sinDatos`: ni un voto escrutado. **Gris liso.** Es el estado real a las
 *   20:00 del 29N y durante todo el simulacro. No lleva rayas: no hay empate,
 *   hay ausencia de datos.
 * - `empate`: varios comparten el máximo. **Rayas diagonales con los colores
 *   de los empatados**, que es más informativo que un gris anónimo: se ve
 *   quiénes se lo están jugando.
 * - `claro`: uno solo en el máximo. Color del partido.
 *
 * Lo usan los tres mapas (provincias, municipios y Senado), así que vive aquí
 * en vez de duplicado: antes solo `MapaSenado` detectaba empates, y lo hacía
 * recalculándolos por su cuenta desde `composicion`.
 */

export const GRIS_SIN_DATOS = '#9AA0A6';

export type EstadoGanador = 'sinDatos' | 'empate' | 'claro';

export type Ganador = {
	siglas: string | null;
	color: string | null;
	escanos: number;
	estado: EstadoGanador;
	empatados: { siglas: string; color: string }[];
};

/** Clave estable de un empate, para no repetir el mismo `<pattern>` 52 veces. */
function claveDe(colores: string[]) {
	return colores.join('-').replace(/#/g, '');
}

export function idPatron(ganador: Ganador | null | undefined): string | null {
	if (!ganador || ganador.estado !== 'empate' || ganador.empatados.length < 2) return null;
	return `empate-${claveDe(ganador.empatados.map((e) => e.color))}`;
}

/**
 * El `fill` que le toca a la región.
 *
 * `var(--paper)` cuando no hay ni objeto `ganador`, que no es lo mismo que
 * `sinDatos`: significa que esa región no está en los datos (un código de
 * provincia que no cuadra con la geometría, por ejemplo), y conviene que se
 * distinga a simple vista de una que sí está pero aún sin escrutar.
 */
export function fillDe(ganador: Ganador | null | undefined): string {
	if (!ganador) return 'var(--paper)';
	if (ganador.estado === 'sinDatos') return GRIS_SIN_DATOS;
	const patron = idPatron(ganador);
	if (patron) return `url(#${patron})`;
	return ganador.color ?? GRIS_SIN_DATOS;
}

/**
 * Los `<pattern>` que hay que declarar en el `<defs>` del SVG, sin repetidos.
 *
 * Se genera uno por combinación de colores, no uno por región: en una noche con
 * varios empates del mismo par de partidos sería el mismo rayado repetido.
 */
export function patronesDe(ganadores: (Ganador | null | undefined)[]) {
	const vistos = new Map<string, string[]>();
	for (const g of ganadores) {
		const id = idPatron(g);
		if (id && !vistos.has(id)) vistos.set(id, g!.empatados.map((e) => e.color));
	}
	return [...vistos.entries()].map(([id, colores]) => ({ id, colores }));
}

/** Texto del popup y de la nota al pie, según el estado. */
export function etiquetaDe(ganador: Ganador | null | undefined): string | null {
	if (!ganador) return null;
	if (ganador.estado === 'sinDatos') return 'Sin escrutar';
	if (ganador.estado === 'empate') return `Empate — ${ganador.empatados.map((e) => e.siglas).join(' | ')}`;
	return null;
}
