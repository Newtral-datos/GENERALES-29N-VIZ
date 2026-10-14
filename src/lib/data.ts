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
	top3: PartidoProvincia[];
};

export type Resultados23J = {
	nacional: Nacional;
	provincias: Record<string, Provincia>;
};

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
