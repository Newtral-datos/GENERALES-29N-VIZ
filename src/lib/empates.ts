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
 * - `empate`: varios comparten el máximo. **Hoy se pinta del color de quien
 *   lleva más votos** (ver `RAYADO_EMPATES`), y que es un empate se dice en el
 *   popup y en la nota al pie, no con el relleno.
 * - `claro`: uno solo en el máximo. Color del partido.
 *
 * Lo usan los tres mapas (provincias, municipios y Senado), así que vive aquí
 * en vez de duplicado: antes solo `MapaSenado` detectaba empates, y lo hacía
 * recalculándolos por su cuenta desde `composicion`.
 */

export const GRIS_SIN_DATOS = '#9AA0A6';

/**
 * Cómo se pinta un empate en los mapas: `false` = color del más votado (lo que
 * está activo), `true` = rayas diagonales con los colores de los empatados.
 *
 * **Poner esto a `true` devuelve el rayado tal cual estaba**, sin tocar nada
 * más: `idPatron`, `patronesDe` y `PatronesEmpate.svelte` siguen escritos y
 * conectados a los tres mapas, y son los que generan las rayas a 45° con un
 * filete blanco de 0,6 px entre color y color (ese filete existe porque dos
 * colores claros del catálogo juntos —EH Bildu `#A4CE4E`, ERC `#FFB400`— se
 * quedan en ~1,7:1 contra el papel y serían ilegibles pegados).
 *
 * Se cambió al color del más votado el 23/11/2026 por decisión editorial. El
 * matiz que había detrás del rayado sigue siendo cierto y conviene recordarlo:
 * el "ganador" de un empate lo decide un desempate por votos, así que pintarlo
 * como una victoria limpia dice más de lo que el dato sabe. Por eso **el empate
 * se sigue declarando** en el popup del territorio y en la nota al pie del
 * mapa: lo que se ha quitado es el relleno, no la información.
 */
export const RAYADO_EMPATES = false;

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
	if (RAYADO_EMPATES) {
		const patron = idPatron(ganador);
		if (patron) return `url(#${patron})`;
	}
	// En un empate, `ganador.color` es el del más votado: el pipeline desempata
	// por votos (ver `_comun_29n.ganador_de`), así que esto ya es "el color de
	// quien tiene más porcentaje de voto" sin recalcular nada aquí.
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

/**
 * Texto del popup y de la nota al pie, según el estado.
 *
 * `conEmpatados: false` deja la etiqueta en un "Empate" seco, sin las siglas.
 * Es lo que necesita el popup del mapa de la home: ahí el subtítulo va pegado
 * al nombre del territorio y encima de una tabla de tres filas, y la lista de
 * siglas lo partía en dos líneas apelotonando el bloque. No se pierde quién
 * empata — están en las propias filas de la tabla del popup.
 */
export function etiquetaDe(
	ganador: Ganador | null | undefined,
	{ conEmpatados = true }: { conEmpatados?: boolean } = {}
): string | null {
	if (!ganador) return null;
	if (ganador.estado === 'sinDatos') return 'Sin escrutar';
	if (ganador.estado === 'empate') {
		if (!conEmpatados) return 'Empate';
		return `Empate — ${ganador.empatados.map((e) => e.siglas).join(' | ')}`;
	}
	return null;
}
