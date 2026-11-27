/**
 * En qué orden se colocan los partidos de izquierda a derecha en la barra de
 * escaños y en el hemiciclo.
 *
 * El criterio base es el de siempre: `lado` ideológico del catálogo (1 =
 * izquierda, 2 = derecha) y, dentro de cada bloque, los grandes hacia fuera y
 * los pequeños hacia el centro. Así los dos bloques crecen desde el centro y la
 * marca de mayoría cae donde tiene que caer.
 *
 * Encima de eso, `EXTREMOS` fija el orden de los bordes exteriores de cada
 * bloque, por delante del criterio de tamaño.
 *
 * **Decisión editorial del 26/11: el PSOE al borde izquierdo del todo y el PP
 * al derecho del todo**, por delante del Frente Amplio y de Vox. Antes era lo
 * contrario —FA por fuera del PSOE y Vox por fuera del PP— con el argumento de
 * que un hemiciclo se lee como un eje ideológico, y conviene saber lo que se
 * cambia: con este orden el dibujo **ya no es un eje ideológico**, porque FA
 * queda a la derecha del PSOE y Vox a la izquierda del PP, que no es donde
 * están. Lo que gana es que las dos fuerzas que se juegan el Gobierno ocupan
 * los dos extremos y se comparan de un vistazo. Si alguien lo ve y le chirría,
 * no es un despiste: es esto.
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
	// sitio que el Frente Amplio en el anillo de esta noche y los dos anillos se
	// leen alineados en vez de cruzados.
	//
	// "SENADO DE PROGRESO" es la marca con la que el PSOE concurre a la cámara
	// alta, así que va detrás del PSOE para que el Senado tenga el mismo borde
	// izquierdo que el Congreso. En cada cámara solo existe una de las dos, y
	// una sigla que no esté en los datos se ignora.
	1: ['PSOE', 'SENADO DE PROGRESO', 'FA', 'SUMAR'],
	2: ['PP', 'Vox']
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

/**
 * Los dos bloques por separado, cada uno ya ordenado de fuera hacia el centro.
 *
 * Hace falta porque **durante el escrutinio no están los 350 escaños
 * repartidos**, y con una sola secuencia el hueco que falta queda al final: la
 * barra y el hemiciclo dejaban un vacío en el borde derecho, que se lee como que
 * la derecha ha sacado menos. El vacío va **en el centro**, que es donde está el
 * centro de la cámara: cada bloque crece desde su borde hacia dentro y lo que
 * falta por contar queda en medio.
 *
 * Al cerrar el escrutinio el hueco es cero y el dibujo es idéntico al de antes.
 */
export function bloquesCamara<T extends Ordenable>(
	items: T[],
	escanosDe: (p: T) => number
): { izquierda: T[]; derecha: T[] } {
	return {
		izquierda: bloque(
			items.filter((p) => ladoDe(p) === 1),
			1,
			escanosDe
		),
		derecha: bloque(
			items.filter((p) => ladoDe(p) === 2),
			2,
			escanosDe
		)
	};
}

/** Los partidos ordenados de izquierda a derecha, listos para pintar. */
export function ordenCamara<T extends Ordenable>(items: T[], escanosDe: (p: T) => number): T[] {
	const { izquierda, derecha } = bloquesCamara(items, escanosDe);
	return [...izquierda, ...derecha];
}
