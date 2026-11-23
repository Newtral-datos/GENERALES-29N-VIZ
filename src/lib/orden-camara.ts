/**
 * En qué orden se colocan los partidos de izquierda a derecha en la barra de
 * escaños y en el hemiciclo.
 *
 * El criterio base es el de siempre: `lado` ideológico del catálogo (1 =
 * izquierda, 2 = derecha) y, dentro de cada bloque, los grandes hacia fuera y
 * los pequeños hacia el centro. Así los dos bloques crecen desde el centro y la
 * marca de mayoría cae donde tiene que caer.
 *
 * Encima de eso, `EXTREMOS` fija a algunos partidos en el borde exterior de su
 * bloque aunque no sean los más grandes: el Frente Amplio a la izquierda del
 * PSOE y VOX a la derecha del PP. Sin esto el extremo de cada lado lo ocupa
 * simplemente el partido con más escaños (PSOE y PP), y la barra se lee como un
 * ranking de tamaño en vez de como un eje ideológico, que es lo que un lector
 * espera de un hemiciclo.
 *
 * Las claves son las siglas que publica el pipeline (`config/partidos.py` en
 * `elecciones-datos`), no las de un fichero del Ministerio: si ahí cambia la
 * sigla visible de una marca, hay que cambiarla aquí. Una sigla que no esté en
 * los datos se ignora sin más, así que la lista puede llevar marcas que no se
 * presenten en una convocatoria concreta.
 *
 * Vive en su propio módulo porque lo usan la barra y el hemiciclo, y antes era
 * la misma ordenación copiada en los dos: cualquier cambio de criterio en uno
 * dejaba al otro contando la historia contraria.
 */

const EXTREMOS: Record<number, string[]> = {
	// Del borde exterior hacia el centro. SUMAR va en la lista por el anillo
	// "ant." del hemiciclo, donde 2023 sigue siendo SUMAR: así ocupa el mismo
	// extremo que el Frente Amplio en el anillo de esta noche y los dos anillos
	// se leen alineados en vez de cruzados.
	1: ['FA', 'SUMAR'],
	2: ['VOX']
};

/**
 * `lado` es opcional porque en los ámbitos territoriales (provincia,
 * municipio) es un campo que solo traen los JSON del 29N. Sin él se cuenta
 * como derecha, que es el mismo valor por defecto que usa el pipeline para una
 * marca que no está en el catálogo (`LADO_FALLBACK` en `config/partidos.py`).
 */
type Ordenable = { lado?: number; siglas: string };

const ladoDe = (p: Ordenable) => (p.lado === 1 ? 1 : 2);

function bloque<T extends Ordenable>(items: T[], lado: number, escanosDe: (p: T) => number): T[] {
	const fijados = EXTREMOS[lado] ?? [];
	const extremos = fijados
		.map((siglas) => items.find((p) => p.siglas === siglas))
		.filter((p): p is T => p !== undefined);
	const resto = items
		.filter((p) => !extremos.includes(p))
		.sort((a, b) => escanosDe(b) - escanosDe(a));

	// Izquierda: del borde izquierdo al centro. Derecha: del centro al borde
	// derecho, que es el mismo orden del revés.
	const deFueraADentro = [...extremos, ...resto];
	return lado === 1 ? deFueraADentro : deFueraADentro.reverse();
}

/** Los partidos ordenados de izquierda a derecha, listos para pintar. */
export function ordenCamara<T extends Ordenable>(items: T[], escanosDe: (p: T) => number): T[] {
	return [
		...bloque(
			items.filter((p) => ladoDe(p) === 1),
			1,
			escanosDe
		),
		...bloque(
			items.filter((p) => ladoDe(p) === 2),
			2,
			escanosDe
		)
	];
}
