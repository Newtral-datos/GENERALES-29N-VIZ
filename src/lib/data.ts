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
	// null = sin continuidad de marca directa con 2019, o partido local no
	// verificado uno a uno (ver congreso_2019_provincias.py) — no es un 0 real.
	escanosAnterior: number | null;
	pctVotosAnterior: number | null;
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
		cacheIndiceMunicipios = fetch(asset('data/indice-municipios.json'), { cache: 'no-cache' }).then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		});
	}
	return cacheIndiceMunicipios;
}

export type PartidoMunicipio = {
	siglas: string;
	color: string;
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
	if (!cacheResultados) cacheResultados = leerJson<Resultados>(rutaDe('congreso'));
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
};

export type ParticipacionNacional = {
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

let cacheParticipacion: Promise<Participacion> | null = null;

export function getParticipacion(): Promise<Participacion> {
	if (!cacheParticipacion) cacheParticipacion = leerJson<Participacion>(rutaDe('participacion'));
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
	provincias: Record<string, ProvinciaSenado>;
};

let cacheSenado: Promise<ResultadosSenado> | null = null;

export function getResultadosSenado(): Promise<ResultadosSenado> {
	if (!cacheSenado) cacheSenado = leerJson<ResultadosSenado>(rutaDe('senado'));
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
