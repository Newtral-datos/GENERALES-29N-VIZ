import { asset } from '$app/paths';

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
	ganador: { siglas: string; color: string; escanos: number };
	principales: PartidoProvincia[];
	otros: { votos: number; pctVotos: number; numCandidaturas: number };
};

export type Resultados23J = {
	nacional: Nacional;
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
		promise = fetch(asset(`data/resultados-municipios/${codProv}.json`), { cache: 'no-cache' }).then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		});
		cacheResultadosMunicipios.set(codProv, promise);
	}
	return promise;
}

let cache: Promise<Resultados23J> | null = null;

export function getResultados23j(): Promise<Resultados23J> {
	if (!cache) {
		cache = fetch(asset('data/resultados23j.json'), { cache: 'no-cache' }).then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		});
	}
	return cache;
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

export type Participacion23J = {
	nacional: ParticipacionNacional;
	provincias: Record<string, ParticipacionProvincia>;
};

let cacheParticipacion23j: Promise<Participacion23J> | null = null;

export function getParticipacion23j(): Promise<Participacion23J> {
	if (!cacheParticipacion23j) {
		cacheParticipacion23j = fetch(asset('data/participacion23j.json'), { cache: 'no-cache' }).then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		});
	}
	return cacheParticipacion23j;
}

export type PartidoSenado = {
	nombre: string;
	siglas: string;
	color: string;
	lado: number;
	escanos: number;
	escanosAnterior: number;
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
	ganador: { siglas: string; color: string; escanos: number };
	composicion: { siglas: string; nombre: string; color: string; escanos: number }[];
	circunscripciones: CircunscripcionSenado[];
};

export type NacionalSenado = {
	fecha: string;
	totalEscanos: number;
	totalEscanosCamara: number;
	escanosDesignadosPendientes: number;
	mayoria: number;
	partidos: PartidoSenado[];
	anterior: { etiqueta: string; totalEscanos: number; mayoria: number };
};

export type ResultadosSenado23J = {
	nacional: NacionalSenado;
	provincias: Record<string, ProvinciaSenado>;
};

let cacheSenado: Promise<ResultadosSenado23J> | null = null;

export function getResultadosSenado23j(): Promise<ResultadosSenado23J> {
	if (!cacheSenado) {
		cacheSenado = fetch(asset('data/resultadosSenado23j.json'), { cache: 'no-cache' }).then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		});
	}
	return cacheSenado;
}
