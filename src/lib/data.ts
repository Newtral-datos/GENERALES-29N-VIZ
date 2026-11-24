import { asset } from '$app/paths';
import { FUENTE_DATOS } from '#lib/config';
import type { Ganador } from '#lib/empates';

/**
 * `asset()` tipa su argumento con la lista literal de ficheros que hay en
 * `static/`, así que una ruta que se construye en tiempo de ejecución (el
 * código de provincia sale de la URL) no encaja con ese tipo aunque el
 * fichero exista. El `as` queda acotado a este helper en vez de repartido
 * por cada llamada, y así `npm run check` sigue sirviendo para detectar
 * rutas de verdad mal escritas en el resto del panel.
 */
export function assetDinamico(ruta: string) {
	return asset(ruta as Parameters<typeof asset>[0]);
}

/**
 * Los cuatro juegos de datos, con el nombre de fichero de cada convocatoria.
 *
 * Los JSON del 29N son un **superconjunto** de los de 23J: mismas claves más
 * `pctEscrutado`, `numEnvio` y `horaTotalizacion` (comprobado fichero a fichero
 * el 18/11/2026). Por eso la conmutación es solo un cambio de ruta y ni los
 * tipos ni los 26 componentes necesitan saber de qué convocatoria leen.
 *
 * Si algún día los JSON de una convocatoria dejan de ser compatibles, esto deja
 * de valer y habría que versionar los tipos — no basta con añadir una fila.
 */
const FICHEROS = {
	congreso: { '23j': 'resultados23j.json', '29n': 'resultados29n.json' },
	participacion: { '23j': 'participacion23j.json', '29n': 'participacion29n.json' },
	senado: { '23j': 'resultadosSenado23j.json', '29n': 'resultadosSenado29n.json' },
	municipios: { '23j': 'resultados-municipios', '29n': 'resultados-municipios-29n' },
	// Solo existe para el 29N: la participación municipal sale de los ficheros
	// `avances-municipios-*`, que son de la jornada y no tienen equivalente en
	// los datos de 23J que se usaron de contenido de prueba.
	participacionMunicipios: {
		'23j': 'participacion-municipios-29n',
		'29n': 'participacion-municipios-29n'
	},
	// Igual que la participación municipal: solo existe para el 29N.
	municipiosSenado: {
		'23j': 'resultados-municipios-senado-29n',
		'29n': 'resultados-municipios-senado-29n'
	}
} as const;

/** Ruta del fichero de un juego de datos para la convocatoria configurada. */
function rutaDe(juego: keyof typeof FICHEROS) {
	return `data/${FICHEROS[juego][FUENTE_DATOS]}`;
}

/** `fetch` + JSON con el mismo tratamiento de error en todos los getters. */
function leerJson<T>(ruta: string): Promise<T> {
	return fetch(assetDinamico(ruta), { cache: 'no-cache' }).then((res) => {
		if (!res.ok) throw new Error(`HTTP ${res.status} al leer ${ruta}`);
		return res.json() as Promise<T>;
	});
}

/**
 * Lo mismo, pero **sin datos no es un error**: devuelve `respaldo`.
 *
 * El 29N a las 20:00 el panel tiene que verse aunque el pipeline todavía no
 * haya dejado ningún JSON, y tiene que seguir viéndose si una petición falla a
 * mitad de la noche (un hipo del CDN, un deploy a medio propagar). Antes no:
 * los getters propagaban el error, los componentes hacían `.then()` sin
 * `.catch`, su estado se quedaba en `null` para siempre y la pantalla entera se
 * quedaba en "Cargando datos…" con todo vacío. Y como la promesa fallida se
 * guardaba en la caché, ni recargar la página lo reintentaba.
 *
 * Así que el fallo se convierte en un juego de datos vacío pero bien formado:
 * cada pieza dibuja su estructura —la barra, los arcos del hemiciclo, la
 * cabecera de la tabla, el mapa en gris— sin ninguna cifra. Quien mira ve un
 * panel esperando datos, que es la verdad, en vez de una página en blanco.
 *
 * No se cachea el respaldo: la siguiente recarga vuelve a pedirlo de verdad.
 */
function leerJsonOVacio<T>(ruta: string, respaldo: T): Promise<T> {
	return leerJson<T>(ruta).catch((e) => {
		console.warn(`[panel] sin datos de ${ruta} (${e.message}) — se dibuja el panel vacío`);
		return respaldo;
	});
}

// Tamaño de las cámaras, para poder dibujar el hemiciclo y la marca de mayoría
// antes de que haya un solo dato. No son cifras "inventadas": las fija la ley
// (art. 68 y 69 CE) y son las mismas que ya publica el pipeline en cada JSON.
// En cuanto llega el primer envío mandan las del fichero, no estas.
const CONGRESO_ESCANOS = 350;
const SENADO_ELECTOS = 208;

const SIN_ESCRUTINIO = {
	censo: 0,
	votantes: 0,
	participacionPct: 0,
	validos: 0,
	votosCandidaturas: 0,
	blanco: 0,
	nulos: 0,
	otros: { votos: 0, pctVotos: 0, numCandidaturas: 0 }
};

/** Congreso sin un solo dato: estructura completa, cero contenido. */
const RESULTADOS_VACIOS: Resultados = {
	nacional: {
		fecha: '',
		...SIN_ESCRUTINIO,
		totalEscanos: CONGRESO_ESCANOS,
		mayoria: Math.floor(CONGRESO_ESCANOS / 2) + 1,
		partidos: [],
		anterior: {
			etiqueta: '',
			totalEscanos: CONGRESO_ESCANOS,
			mayoria: Math.floor(CONGRESO_ESCANOS / 2) + 1,
			partidos: []
		}
	},
	comunidades: {},
	provincias: {}
};

/** Senado sin un solo dato. Ver RESULTADOS_VACIOS. */
const SENADO_VACIO: ResultadosSenado = {
	nacional: {
		fecha: '',
		totalEscanos: SENADO_ELECTOS,
		totalEscanosCamara: SENADO_ELECTOS,
		escanosDesignadosPendientes: 0,
		mayoria: Math.floor(SENADO_ELECTOS / 2) + 1,
		partidos: [],
		anterior: {
			etiqueta: '',
			totalEscanos: SENADO_ELECTOS,
			mayoria: Math.floor(SENADO_ELECTOS / 2) + 1,
			partidos: []
		}
	},
	comunidades: {},
	provincias: {}
};

/**
 * Qué enseña el panel cuando todavía no hay datos de la jornada.
 *
 * **La composición de la convocatoria anterior, que es un dato fijo.** No
 * depende del escrutinio: son los escaños de julio de 2023, salen de los
 * ficheros `ant-*` del Ministerio y el pipeline los publica aparte
 * (`anterior-congreso.json` / `anterior-senado.json`, ver
 * `pipeline/procesado/anterior_29n.py`). Antes esa lista solo existía dentro
 * del JSON de la jornada, así que al faltar ese fichero el panel se quedaba sin
 * el único dato que sí tenía: a las 20:00 del 29N la tabla y el hemiciclo
 * salían vacíos teniendo 2023 a mano.
 *
 * Si tampoco está el fichero fijo, se cae al juego vacío del todo: estructura
 * sin cifras, nunca una página en blanco.
 */
function respaldoCongreso(e: Error): Promise<Resultados> {
	console.warn(`[panel] sin datos del Congreso (${e.message}) — se dibuja la composición de 2023`);
	return leerJsonOVacio<Nacional['anterior']>(
		'data/anterior-congreso.json',
		RESULTADOS_VACIOS.nacional.anterior
	).then((anterior) => ({
		...RESULTADOS_VACIOS,
		nacional: { ...RESULTADOS_VACIOS.nacional, anterior }
	}));
}

function respaldoSenado(e: Error): Promise<ResultadosSenado> {
	console.warn(`[panel] sin datos del Senado (${e.message}) — se dibuja la composición de 2023`);
	return leerJsonOVacio<NacionalSenado['anterior']>(
		'data/anterior-senado.json',
		SENADO_VACIO.nacional.anterior
	).then((anterior) => ({
		...SENADO_VACIO,
		nacional: { ...SENADO_VACIO.nacional, anterior }
	}));
}

export type Partido = {
	nombre: string;
	siglas: string;
	votos: number;
	escanos: number;
	color: string;
	lado: number;
	pctVotos: number;
	// null = sin continuidad de marca directa con la convocatoria anterior
	// (p. ej. SUMAR no existía en 2019, U.P.N. no se presentó sola) — no hay
	// cifra "propia" con la que comparar, no es un 0 real.
	escanosAnterior: number | null;
	// Mismo criterio de null. Opcional porque los JSON de 23J no lo traen en el
	// bloque nacional: solo los del 29N.
	pctVotosAnterior?: number | null;
};

export type PartidoAnterior = { siglas: string; nombre: string; escanos: number; color: string; lado: number };

export type Nacional = {
	fecha: string;
	// Solo en los JSON del 29N: la jornada en curso. En los de 23J no existen,
	// porque ese escrutinio está cerrado desde hace años.
	pctEscrutado?: number;
	horaTotalizacion?: string;
	numEnvio?: number;
	mesasTotales?: number;
	censo: number;
	votantes: number;
	participacionPct: number;
	validos: number;
	votosCandidaturas: number;
	blanco: number;
	nulos: number;
	totalEscanos: number;
	mayoria: number;
	partidos: Partido[];
	otros: { votos: number; pctVotos: number; numCandidaturas: number };
	// Composición real y completa del Congreso en la convocatoria anterior —
	// lista propia e independiente de `partidos`, puede incluir partidos que
	// hoy no se presentan (ver congreso_2019_anterior.py).
	anterior: { etiqueta: string; totalEscanos: number; mayoria: number; partidos: PartidoAnterior[] };
};

export type PartidoProvincia = {
	siglas: string;
	nombre: string;
	votos: number;
	escanos: number;
	pctVotos: number;
	color: string;
	// Lado ideológico del catálogo (1 izquierda / 2 derecha), para ordenar la
	// barra de escaños de la provincia — ver #lib/orden-camara. Solo 29N: los
	// JSON de 23J no lo traen en los ámbitos territoriales.
	lado?: number;
	// null = sin continuidad de marca directa con 2019, o partido local no
	// verificado uno a uno (ver congreso_2019_provincias.py) — no es un 0 real.
	escanosAnterior: number | null;
	pctVotosAnterior: number | null;
};

// La batalla por el último escaño de una circunscripción, tal como la publica
// el Ministerio: quién lo tiene, quién se lo puede arrebatar y por cuántos
// votos. No lo calcula el panel ni el pipeline — son tres campos del fichero
// de totales (ver `congreso_29n.ultimo_escano`).
//
// `votosFaltantes` no se puede enseñar sin `censoSinEscrutar`: un hueco de
// 1.010 votos es una batalla viva si quedan 19.863 por contar y está decidida
// si no queda ninguno.
export type UltimoEscano = {
	tiene: { siglas: string; color: string };
	aspirante: { siglas: string; color: string };
	votosFaltantes: number;
	censoSinEscrutar: number;
};

export type Provincia = {
	nombre: string;
	// Solo 29N (ver Nacional).
	pctEscrutado?: number;
	// `estado` distingue "sin escrutar" de "empate" de "gana uno": el color por
	// sí solo no puede decirlo. Ver #lib/empates.
	ganador: Ganador;
	principales: PartidoProvincia[];
	otros: { votos: number; pctVotos: number; numCandidaturas: number };
	// Solo en provincias y solo con escrutinio empezado: el último escaño se
	// decide por circunscripción, así que en comunidades viene siempre ausente.
	ultimoEscano?: UltimoEscano | null;
};

export type Resultados = {
	nacional: Nacional;
	// Las 19 comunidades (17 + Ceuta y Melilla) con la misma forma que las
	// provincias: el pipeline las construye con la misma función, para que el
	// mapa de la home pueda cambiar de nivel sin cambiar de lógica.
	comunidades: Record<string, Provincia>;
	provincias: Record<string, Provincia>;
};

export type EscanosProvincia = { nombre: string; escanos: number };

let cacheEscanosProvincias: Promise<Record<string, EscanosProvincia>> | null = null;

export function getEscanosCongresoProvincias(): Promise<Record<string, EscanosProvincia>> {
	if (!cacheEscanosProvincias) {
		cacheEscanosProvincias = fetch(asset('data/escanos-congreso-provincias.json'), {
			cache: 'no-cache'
		}).then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		});
	}
	return cacheEscanosProvincias;
}

let cacheCcaaProvincias: Promise<Record<string, string>> | null = null;

export function getCcaaProvincias(): Promise<Record<string, string>> {
	if (!cacheCcaaProvincias) {
		cacheCcaaProvincias = fetch(asset('data/ccaa-provincias.json'), { cache: 'no-cache' }).then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		});
	}
	return cacheCcaaProvincias;
}

export type MunicipioIndice = { nombre: string; provincia: string; codProv: string; ine: string };

let cacheIndiceMunicipios: Promise<MunicipioIndice[]> | null = null;

export function getIndiceMunicipios(): Promise<MunicipioIndice[]> {
	if (!cacheIndiceMunicipios) {
		// `assetDinamico` y no `asset`: este fichero **lo genera el pipeline**
		// (congreso_29n_municipios) y no está versionado, así que la lista
		// literal de ficheros de `static/` con la que `asset()` tipa su
		// argumento no lo incluye en un clon limpio ni mientras los datos están
		// por regenerar — y `npm run check` fallaba por un fichero que no falta,
		// solo que todavía no está. Mismo criterio que el resto de JSON de datos
		// (ver `leerJson`). El buscador aguanta que falte: devuelve [] y el
		// desplegable se queda vacío.
		cacheIndiceMunicipios = leerJsonOVacio<MunicipioIndice[]>('data/indice-municipios.json', []);
	}
	return cacheIndiceMunicipios;
}

export type PartidoMunicipio = {
	siglas: string;
	color: string;
	// Ver PartidoProvincia.lado.
	lado?: number;
	votos: number;
	pctVotos: number;
	// null = sin continuidad de marca directa con 2019, o partido local no
	// verificado uno a uno (ver congreso_2019_municipios.py) — no es un 0 real.
	pctVotosAnterior: number | null;
};

export type ResultadoMunicipio = {
	nombre: string;
	// Solo 29N: antes el mapa cogía `principales[0]` como ganador, que con 0
	// votos escrutados es el primero al ordenar.
	ganador?: Ganador;
	poblacion: number;
	mesas: number;
	censo: number;
	votantes: number;
	validos: number;
	votosCandidaturas: number;
	blanco: number;
	nulos: number;
	participacionPct: number;
	principales: PartidoMunicipio[];
	otros: { votos: number; pctVotos: number; numCandidaturas: number };
};

const cacheResultadosMunicipios = new Map<string, Promise<Record<string, ResultadoMunicipio>>>();

export function getResultadosMunicipios(codProv: string): Promise<Record<string, ResultadoMunicipio>> {
	let promise = cacheResultadosMunicipios.get(codProv);
	if (!promise) {
		promise = leerJson<Record<string, ResultadoMunicipio>>(`${rutaDe('municipios')}/${codProv}.json`);
		cacheResultadosMunicipios.set(codProv, promise);
	}
	return promise;
}

let cacheResultados: Promise<Resultados> | null = null;

export function getResultados(): Promise<Resultados> {
	if (!cacheResultados) cacheResultados = leerJson<Resultados>(rutaDe('congreso')).catch(respaldoCongreso);
	return cacheResultados;
}

export type AvanceParticipacion = {
	hora: string;
	etiqueta: string;
	// null = corte todavía no publicado por el Ministerio esa noche (no aplica
	// a los datos históricos de 23J, que ya están cerrados, pero sí a futuras
	// convocatorias mientras el pipeline se vaya ejecutando a lo largo del día).
	votantes: number | null;
	participacionPct: number | null;
	participacionPctAnterior: number | null;
	// `true` si esa cifra no viene del envío actual sino de la publicación
	// anterior: el fichero del Ministerio deja de traer los avances cuando llega
	// el cierre, y los cortes ya ocurridos se conservan para poder compararlos
	// (ver participacion_29n.con_publicados). El dato es igual de real.
	recuperado?: boolean;
};

export type ParticipacionNacional = {
	// Sello del envío. Entre las 8:00 y las 20:00 del 29N este es el único
	// fichero que se regenera, así que es el que da la hora del faldón.
	fecha?: string;
	horaTotalizacion?: string;
	// Solo 29N: `pctSobreCensoTotal` es el crudo sobre el censo completo, que se
	// publica aparte para poder auditar la diferencia con `participacionPct`
	// (calculado sobre censo escrutado, ver AGENTS.md).
	pctEscrutado?: number;
	pctSobreCensoTotal?: number;
	mesas?: number;
	mesasConstituidas?: number;
	censo: number;
	votantes: number;
	participacionPct: number;
	censoAnterior: number;
	votantesAnterior: number;
	participacionPctAnterior: number;
	avances: AvanceParticipacion[];
};

export type ParticipacionProvincia = {
	nombre: string;
	// Solo 29N (ver ParticipacionNacional).
	pctEscrutado?: number;
	pctSobreCensoTotal?: number;
	mesasConstituidas?: number;
	poblacion: number;
	mesas: number;
	censo: number;
	votantes: number;
	participacionPct: number;
	censoAnterior: number;
	votantesAnterior: number;
	participacionPctAnterior: number;
	avances: AvanceParticipacion[];
};

export type Participacion = {
	nacional: ParticipacionNacional;
	provincias: Record<string, ParticipacionProvincia>;
};

/**
 * Participación sin datos: los tres cortes existen pero vacíos.
 *
 * Importante que estén los tres con `participacionPct: null` y no una lista
 * vacía: la UI distingue "corte pendiente" (marcador hueco) de "0 %", y con el
 * array vacío no habría ni cajas que enseñar. Es el mismo criterio que usa el
 * pipeline antes de que llegue el primer avance.
 */
const PARTICIPACION_VACIA: Participacion = {
	nacional: {
		censo: 0,
		votantes: 0,
		participacionPct: 0,
		censoAnterior: 0,
		votantesAnterior: 0,
		participacionPctAnterior: 0,
		avances: [
			{ hora: '14:00', etiqueta: 'Primer avance', votantes: null, participacionPct: null, participacionPctAnterior: null },
			{ hora: '18:00', etiqueta: 'Segundo avance', votantes: null, participacionPct: null, participacionPctAnterior: null },
			{ hora: 'Cierre', etiqueta: 'Cierre de la jornada', votantes: null, participacionPct: null, participacionPctAnterior: null }
		]
	},
	provincias: {}
};

let cacheParticipacion: Promise<Participacion> | null = null;

export function getParticipacion(): Promise<Participacion> {
	if (!cacheParticipacion) {
		cacheParticipacion = leerJsonOVacio<Participacion>(rutaDe('participacion'), PARTICIPACION_VACIA);
	}
	return cacheParticipacion;
}

export type PartidoSenado = {
	nombre: string;
	siglas: string;
	color: string;
	lado: number;
	escanos: number;
	// null = sin continuidad de marca directa con 2019 (ver senado_2019_anterior.py)
	escanosAnterior: number | null;
};

export type GanadorCirc = {
	nombre: string;
	siglas: string;
	color: string;
	votos: number;
};

export type CircunscripcionSenado = {
	nombre: string;
	escanos: number;
	ganadores: GanadorCirc[];
};

export type ProvinciaSenado = {
	nombre: string;
	ganador: Ganador;
	composicion: { siglas: string; nombre: string; color: string; escanos: number }[];
	circunscripciones: CircunscripcionSenado[];
};

export type NacionalSenado = {
	fecha: string;
	// Solo 29N (ver Nacional).
	pctEscrutado?: number;
	horaTotalizacion?: string;
	totalEscanos: number;
	totalEscanosCamara: number;
	escanosDesignadosPendientes: number;
	mayoria: number;
	partidos: PartidoSenado[];
	// `partidos`: los senadores electos en la convocatoria anterior, por marca.
	// Solo escaños — el fichero `ANT` del Senado no trae votos ni candidatos.
	anterior: {
		etiqueta: string;
		totalEscanos: number;
		mayoria: number;
		partidos: PartidoAnteriorSenado[];
	};
};

export type PartidoAnteriorSenado = {
	siglas: string;
	nombre: string;
	escanos: number;
	color: string;
	lado: number;
};

export type ResultadosSenado = {
	nacional: NacionalSenado;
	// Las 19 comunidades con su reparto de senadores electos. Salen de los
	// registros "CM" del fichero de totales, que el Senado sí trae aunque no
	// tenga ámbito de provincia (se vota por circunscripción).
	comunidades: Record<string, ProvinciaSenado>;
	provincias: Record<string, ProvinciaSenado>;
};

let cacheSenado: Promise<ResultadosSenado> | null = null;

export function getResultadosSenado(): Promise<ResultadosSenado> {
	if (!cacheSenado) cacheSenado = leerJson<ResultadosSenado>(rutaDe('senado')).catch(respaldoSenado);
	return cacheSenado;
}

export type AvanceMunicipio = {
	hora: string;
	etiqueta: string;
	votantes: number | null;
	// null = ese corte todavía no se ha publicado. No es un 0.
	participacionPct: number | null;
	pctMesasNotificadas: number | null;
	mesasNotificadas: number | null;
	// Solo en el corte de cierre: la API publica la participación municipal de
	// 23J pero no sus avances, así que los cortes de 14:00 y 18:00 no tienen
	// con qué compararse.
	participacionPctAnterior?: number | null;
	censoAnterior?: number | null;
	votantesAnterior?: number | null;
	// `true` si esa cifra no viene del envío actual sino de la publicación
	// anterior: el fichero del Ministerio deja de traer los avances cuando llega
	// el cierre, y los cortes ya ocurridos se conservan para poder compararlos
	// (ver participacion_29n.con_publicados). El dato es igual de real.
	recuperado?: boolean;
};

export type ParticipacionMunicipio = {
	nombre: string;
	poblacion: number | null;
	censo: number | null;
	mesas: number | null;
	mesasConstituidas: number | null;
	avances: AvanceMunicipio[];
};

const cacheParticipacionMunicipios = new Map<string, Promise<Record<string, ParticipacionMunicipio>>>();

/** Participación por municipio de una provincia, para el mapa de /participacion. */
export function getParticipacionMunicipios(
	codProv: string
): Promise<Record<string, ParticipacionMunicipio>> {
	let promise = cacheParticipacionMunicipios.get(codProv);
	if (!promise) {
		promise = leerJson<Record<string, ParticipacionMunicipio>>(
			`${rutaDe('participacionMunicipios')}/${codProv}.json`
		);
		cacheParticipacionMunicipios.set(codProv, promise);
	}
	return promise;
}

export type PartidoMunicipioSenado = {
	siglas: string;
	nombre: string;
	color: string;
	votos: number;
	pctVotos: number;
};

export type ResultadoMunicipioSenado = {
	nombre: string;
	censo: number | null;
	mesas: number | null;
	votantes: number | null;
	pctEscrutado: number | null;
	blanco: number | null;
	nulos: number | null;
	// Votos a CANDIDATOS, no papeletas: con voto limitado cada votante marca
	// hasta 3, así que esta cifra vale ~3x sus votantes y no es comparable con
	// la del Congreso. Ver senado_29n_municipios.py.
	votosCandidatos: number;
	ganador: Ganador;
	principales: PartidoMunicipioSenado[];
	otros: { votos: number; pctVotos: number; numCandidaturas: number };
};

const cacheMunicipiosSenado = new Map<string, Promise<Record<string, ResultadoMunicipioSenado>>>();

/** Resultados del Senado por municipio de una provincia. */
export function getMunicipiosSenado(
	codProv: string
): Promise<Record<string, ResultadoMunicipioSenado>> {
	let promise = cacheMunicipiosSenado.get(codProv);
	if (!promise) {
		promise = leerJson<Record<string, ResultadoMunicipioSenado>>(
			`${rutaDe('municipiosSenado')}/${codProv}.json`
		);
		cacheMunicipiosSenado.set(codProv, promise);
	}
	return promise;
}
