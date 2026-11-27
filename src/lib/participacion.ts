import type {
	ArrastreAvance,
	AvanceMunicipio,
	AvanceParticipacion,
	ParticipacionNacional
} from '#lib/data';

/**
 * Cuál de los tres cortes de la jornada es el último con dato.
 *
 * La jornada tiene tres: primer avance (14:00), segundo (18:00) y cierre. Antes
 * de publicarse, los campos de un corte van en `null` —no en `0`, que sería un
 * dato real y falso— así que "el último con dato" es el que manda.
 *
 * Vive aquí porque lo usan la vista de participación (que lo reparte a sus tres
 * piezas para que se muevan juntas) y la cifra de contexto de las portadas de
 * Congreso y Senado. El AGENTS.md pide explícitamente que esto se calcule **una
 * sola vez**: con cada componente decidiéndolo por su cuenta, el mapa, el
 * ranking y el número grande podían quedarse en cortes distintos.
 *
 * Devuelve -1 si todavía no hay ningún avance publicado.
 */
export function indiceAvanceActivo(nacional: ParticipacionNacional | null): number {
	if (!nacional) return -1;
	let idx = -1;
	nacional.avances.forEach((a, i) => {
		if (a.participacionPct !== null) idx = i;
	});
	return idx;
}

/** El corte activo, o `null` si no hay ninguno publicado. */
export function avanceActivo(nacional: ParticipacionNacional | null): AvanceParticipacion | null {
	const idx = indiceAvanceActivo(nacional);
	return idx >= 0 && nacional ? nacional.avances[idx] : null;
}

/**
 * Qué porcentaje pintar para un ámbito en el corte activo.
 *
 * Los avances no entran de golpe: notifican unas mesas, luego otras, así que
 * durante un buen rato el corte de las 18:00 ya tiene cifra nacional y le
 * faltan provincias (y muchísimos municipios). Como el corte activo se decide
 * una sola vez y a nivel nacional —`indiceAvanceActivo`, para que el mapa, el
 * ranking y la cifra grande se muevan juntos—, esos ámbitos devolvían `null` y
 * el mapa se vaciaba justo en el momento en que entra un avance.
 *
 * Así que si el corte no tiene cifra propia pero el pipeline ha dejado colgado
 * el avance anterior (`arrastrado`, ver `participacion_29n.con_arrastre`), se
 * pinta ese — y se devuelve `arrastrado` para que quien lo pinte **diga de qué
 * hora es**. Un porcentaje de las 14:00 bajo un rótulo de las 18:00, sin avisar,
 * es un dato falso; con el aviso es la foto más reciente que hay de esa
 * provincia, que es la verdad.
 *
 * Vive aquí por la misma razón que `indiceAvanceActivo`: lo usan el mapa de
 * provincias, el de municipios y el ranking, y tienen que coincidir.
 */
export function pctDelCorte(avance: AvanceParticipacion | AvanceMunicipio | null | undefined): {
	pct: number | null;
	arrastrado: ArrastreAvance | null;
} {
	if (!avance) return { pct: null, arrastrado: null };
	if (avance.participacionPct !== null) return { pct: avance.participacionPct, arrastrado: null };
	const arrastrado = avance.arrastrado ?? null;
	return { pct: arrastrado?.participacionPct ?? null, arrastrado };
}
