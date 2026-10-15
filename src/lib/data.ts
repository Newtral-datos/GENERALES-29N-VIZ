import { asset } from '$app/paths';

export type Partido = {
	nombre: string;
	siglas: string;
	votos: number;
	escanos: number;
	color: string;
	lado: number;
	pctVotos: number;
	escanosAnterior: number;
};

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
	anterior: { etiqueta: string; totalEscanos: number; mayoria: number };
};

export type PartidoProvincia = {
	siglas: string;
	nombre: string;
	votos: number;
	escanos: number;
	pctVotos: number;
	color: string;
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
			cache: 'force-cache'
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
		cacheCcaaProvincias = fetch(asset('data/ccaa-provincias.json'), { cache: 'force-cache' }).then((res) => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		});
	}
	return cacheCcaaProvincias;
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
