<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { formatMiles } from '#lib/format';
	import MapaTerritorios from '#lib/components/MapaTerritorios.svelte';
	import MapaMunicipios, { type MunicipioSeleccionado } from '#lib/components/MapaMunicipios.svelte';
	import {
		getResultados,
		getEscanosCongresoProvincias,
		type Resultados,
		type EscanosProvincia
	} from '#lib/data';
	import { ordenCamara } from '#lib/orden-camara';
	import { tintaSobre } from '#lib/color';
	import { etiquetaDe } from '#lib/empates';
	import type { MunicipioIndice, Provincia } from '#lib/data';
	import { CONVOCATORIA, CONVOCATORIA_ANTERIOR } from '#lib/config';

	/**
	 * Mapa a la izquierda, resultados a la derecha.
	 *
	 * Misma navegación que el mapa de la home —se reutiliza `MapaTerritorios`, no
	 * hay un mapa gemelo— pero abriendo en **provincias** en vez de en
	 * comunidades: la pregunta de esta vista es "qué pasó en mi provincia", así
	 * que el nivel de comunidad no aporta. Al pulsar una provincia el mapa pasa a
	 * sus municipios y la columna derecha se llena con esa provincia; al pulsar un
	 * municipio, con el municipio.
	 *
	 * Antes esto era un acordeón de comunidades y provincias a la izquierda, con
	 * el mapa municipal colgando **debajo** del detalle: la lista mandaba y el
	 * mapa era secundario.
	 */

	let datos = $state<Resultados | null>(null);
	let escanosProvincias = $state<Record<string, EscanosProvincia> | null>(null);

	// Estado del mapa, compartido con él por `bind:`. Vive en el motor y se lee
	// aquí porque la tabla de la derecha necesita saber qué hay abierto.
	let nivel = $state<'ccaa' | 'provincia' | 'municipio'>('provincia');
	let codProvSel = $state<string | null>(null);
	let muniSel = $state<MunicipioSeleccionado | null>(null);

	$effect(() => {
		getResultados().then((d) => {
			datos = d;
		});
	});

	$effect(() => {
		getEscanosCongresoProvincias().then((d) => {
			escanosProvincias = d;
		});
	});

	// Enlace de entrada: `?cod=` lo escriben el mapa de la home y el buscador de
	// municipios, así que hay que respetarlo. Se lee **una sola vez**: después
	// manda el mapa.
	let inicializadoDesdeUrl = false;
	$effect(() => {
		if (inicializadoDesdeUrl || !datos) return;
		inicializadoDesdeUrl = true;
		const cod = page.url.searchParams.get('cod');
		if (cod && datos.provincias[cod]) {
			codProvSel = cod;
			nivel = 'municipio';
		}
	});

	/**
	 * La URL se escribe desde el manejador del clic, nunca desde un `$effect`.
	 *
	 * Un efecto que lea `page.url` y además lo modifique con `replaceState` se
	 * vuelve a disparar a sí mismo en bucle y cuelga la pestaña — pasó
	 * exactamente así en este proyecto (ver AGENTS.md).
	 */
	function alCambiarDeNivel(_nivel: string, cod: string | null) {
		muniBuscado = null;
		const params = new URLSearchParams(page.url.searchParams.toString());
		// Al cambiar de ámbito el municipio marcado deja de tener sentido, así
		// que `muni` se va siempre: es de la provincia que se acaba de cerrar.
		params.delete('muni');
		if (cod) params.set('cod', cod);
		else params.delete('cod');
		const qs = params.toString();
		replaceState(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, page.state);
	}

	/**
	 * Las 52, ordenadas por nombre: la tabla de entrada, y a la vez la forma de
	 * llegar a una provincia por su nombre, que en un mapa no se puede.
	 *
	 * **Con `escanos-congreso-provincias.json` de respaldo**, que es una tabla
	 * fija del repo y existe siempre. Sin ese respaldo la vista entera dependía
	 * de `datos.provincias`, que en el estado previo a la jornada es `{}`: la
	 * lista salía vacía, `activa` era siempre `null` y la columna derecha no
	 * cambiaba ni al pulsar en el mapa ni al buscar un municipio. El panel tiene
	 * que verse sin datos de la jornada (norma del AGENTS.md) y esta vista se
	 * había quedado fuera.
	 */
	let listaProvincias = $derived.by(() => {
		const conDatos = datos ? Object.entries(datos.provincias) : [];
		if (conDatos.length) {
			return conDatos
				// `principales` ya viene ordenado por votos desde el pipeline, así
				// que las tres primeras son las tres más votadas de la provincia.
				.map(([cod, p]) => ({ cod, nombre: p.nombre, top: p.principales.slice(0, 3) }))
				.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
		}
		return Object.entries(escanosProvincias ?? {})
			.map(([cod, p]) => ({ cod, nombre: p.nombre, top: [] }))
			.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
	});

	// El ámbito abierto. Si no hay datos de la jornada se sostiene con el nombre
	// de la tabla fija: así la cabecera dice dónde está el lector y la tabla
	// dibuja su estructura vacía, en vez de no aparecer.
	let activa = $derived.by(() => {
		if (!codProvSel) return null;
		const conDatos = datos?.provincias[codProvSel];
		if (conDatos) return conDatos;
		const nombre = escanosProvincias?.[codProvSel]?.nombre;
		return nombre ? { nombre, principales: [], otros: null } : null;
	});

	let escanosTotalActiva = $derived(
		codProvSel && escanosProvincias ? escanosProvincias[codProvSel]?.escanos ?? null : null
	);

	let barraSegments = $derived.by(() => {
		if (!activa) return [];
		const conEscanos = activa.principales.filter((p) => p.escanos > 0);
		const total = conEscanos.reduce((acc, p) => acc + p.escanos, 0);
		return ordenCamara(conEscanos, (p) => p.escanos).map((p) => ({
			...p,
			pct: total ? (p.escanos / total) * 100 : 0
		}));
	});

	function volverAProvincia() {
		muniSel = null;
		if (page.url.searchParams.has('muni')) {
			const params = new URLSearchParams(page.url.searchParams.toString());
			params.delete('muni');
			replaceState(`${page.url.pathname}?${params.toString()}`, page.state);
		}
	}

	/**
	 * El buscador encontró un municipio, y estamos ya en `/provincias`.
	 *
	 * Orden importante: primero la URL y después el estado. `MapaMunicipios` lee
	 * `?muni=` **al montarse**, así que cuando el `{#key}` lo vuelva a montar la
	 * query string tiene que estar ya puesta.
	 *
	 * `muniBuscado` entra en esa clave para cubrir el caso de buscar un municipio
	 * de la provincia que ya está abierta: ahí `cod` no cambia, no habría
	 * remonte, y el municipio nuevo no se preseleccionaría. Solo lo mueve el
	 * buscador, así que pulsar municipios en el mapa no remonta nada.
	 */
	let muniBuscado = $state<string | null>(null);

	/**
	 * Alto de la columna del mapa, medido.
	 *
	 * La tabla de entrada son 52 filas y, sin tope, estiraba la página muy por
	 * debajo del mapa. Se mide en vez de fijar un `max-height` a ojo porque el
	 * alto del mapa depende del encuadre del SVG y del ancho disponible, así que
	 * cualquier número escrito a mano se desalinea en cuanto cambia la ventana.
	 *
	 * Se publica como variable CSS y **solo la consume la media query de dos
	 * columnas**: apilados no hay nada a lo que igualar el alto, y una tabla con
	 * scroll propio dentro de una página que ya scrollea se lleva el gesto del
	 * dedo.
	 */
	let altoMapa = $state(0);

	function alBuscarMunicipio(m: MunicipioIndice) {
		const params = new URLSearchParams(page.url.searchParams.toString());
		params.set('cod', m.codProv);
		params.set('muni', m.ine);
		replaceState(`${page.url.pathname}?${params.toString()}`, page.state);
		muniBuscado = m.ine;
		codProvSel = m.codProv;
		nivel = 'municipio';
	}

	// En móvil las dos columnas se apilan, así que al pulsar en el mapa la tabla
	// queda fuera de pantalla y parece que no ha pasado nada. Este botón salva
	// ese salto; en escritorio no hace falta y está oculto.
	function irALaTabla() {
		document.getElementById('resultados-territorio')?.scrollIntoView({
			behavior: 'smooth',
			block: 'start'
		});
	}
</script>

<div class="panel">
	{#if !datos}
		<p class="loading">Cargando datos…</p>
	{:else}
		<div class="layout">
			<div class="col-mapa" bind:clientHeight={altoMapa}>
				<MapaTerritorios
					comunidades={null}
					provincias={datos.provincias}
					nivelInicial="provincia"
					bind:nivel
					bind:codProvSel
					buscador
					onCambioDeNivel={alCambiarDeNivel}
					onMunicipio={alBuscarMunicipio}
					nota={`Partido ganador por provincia — ${CONVOCATORIA} — pulsa una provincia para ver sus municipios. Gris = sin escrutar; en un empate se pinta el color del más votado`}
				>
					{#snippet popup(a)}
						<!-- `a as Provincia`: el motor del mapa solo se compromete con
						     `{nombre, ganador}` —es lo que comparten Congreso y Senado— y
						     cada vista añade lo suyo en su propio popup. Mismo casteo que
						     hace la home. -->
						<table class="popup-tabla">
							<thead>
								<tr>
									<th class="th-left">
										{a.nombre}
										{#if etiquetaDe(a.ganador, { conEmpatados: false })}
											<span class="popup-estado">{etiquetaDe(a.ganador, { conEmpatados: false })}</span>
										{/if}
									</th>
									<th>Escaños</th>
									<th>Voto (%)</th>
								</tr>
							</thead>
							<tbody>
								{#each (a as Provincia).principales.slice(0, 3) as p (p.siglas)}
									<tr>
										<td class="popup-party">
											<span class="swatch" style="background:{p.color}"></span>
											{p.siglas}
										</td>
										<td class="popup-num">{p.escanos}</td>
										<td class="popup-num">
											{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/snippet}

					{#snippet municipios(cod)}
						{#key `${cod}/${muniBuscado ?? ''}`}
							<MapaMunicipios {cod} bind:seleccionado={muniSel} />
						{/key}
					{/snippet}
				</MapaTerritorios>

				{#if activa}
					<button type="button" class="ir-a-tabla" onclick={irALaTabla}>
						Ver resultados de {muniSel ? muniSel.nombre : activa.nombre} ↓
					</button>
				{/if}
			</div>

			<div
				class="col-tabla"
				id="resultados-territorio"
				style:--alto-mapa={altoMapa ? `${altoMapa}px` : null}
			>
				{#if muniSel}
					<button type="button" class="volver-muni" onclick={volverAProvincia}>
						← Volver a {activa?.nombre}
					</button>
			<p class="sub-kicker">{muniSel.nombre}</p>

			{#if muniSel.resultado}
				{@const r = muniSel.resultado}
				<ul class="stats">
					<li><span class="stat-label">Censo</span><span class="stat-value">{formatMiles(r.censo)}</span></li>
					<li><span class="stat-label">Votantes</span><span class="stat-value">{formatMiles(r.votantes)}</span></li>
					<li><span class="stat-label">Participación</span><span class="stat-value">{r.participacionPct.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%</span></li>
					<li><span class="stat-label">Válidos</span><span class="stat-value">{formatMiles(r.validos)}</span></li>
					<li><span class="stat-label">Blanco</span><span class="stat-value">{formatMiles(r.blanco)}</span></li>
					<li><span class="stat-label">Nulos</span><span class="stat-value">{formatMiles(r.nulos)}</span></li>
				</ul>

				<div class="tabla-scroll">
					<table class="tabla">
						<thead>
							<tr>
								<th class="th-left">Partido</th>
								<th>Votos</th>
								<th>%</th>
								<th>Dif. %</th>
							</tr>
						</thead>
						<tbody>
							{#each r.principales as p (p.siglas)}
								{@const difPct = p.pctVotosAnterior === null ? null : Math.round((p.pctVotos - p.pctVotosAnterior) * 100) / 100}
								<tr>
									<td>
										<div class="party-cell">
											<span class="swatch" style="background:{p.color}"></span>
											<span class="party-name">{p.siglas}</span>
										</div>
									</td>
									<td class="num">{formatMiles(p.votos)}</td>
									<td class="num">{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
									<td class="num">
										{#if difPct === null}
											<span class="dif sin-dato" title="No se presentó con esta marca en {CONVOCATORIA_ANTERIOR}, no es comparable">—</span>
										{:else}
											<span class="dif" class:up={difPct > 0} class:down={difPct < 0}>
												{difPct > 0 ? '+' : ''}{difPct.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
											</span>
										{/if}
									</td>
								</tr>
							{/each}
							{#if r.otros.numCandidaturas > 0}
								<tr class="fila-otros">
									<td>
										<div class="party-cell">
											<span class="swatch swatch-otros"></span>
											<span class="party-name">Otros ({r.otros.numCandidaturas})</span>
										</div>
									</td>
									<td class="num">{formatMiles(r.otros.votos)}</td>
									<td class="num">{r.otros.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
									<td class="num">—</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
				<p class="nota">Resultados del municipio — {CONVOCATORIA}</p>
			{:else}
				<p class="placeholder">Sin datos para este municipio.</p>
			{/if}
				{:else if activa}
					<p class="sub-kicker">
						{activa.nombre}{#if escanosTotalActiva !== null}
							<span class="prov-total-escanos"> — {escanosTotalActiva} diputados</span>
						{/if}
					</p>
			<div class="barra-wrap">
				<div class="barra">
					{#each barraSegments as s (s.siglas)}
						<div class="seg" style="width:{s.pct}%; background:{s.color}" title="{s.nombre}: {s.escanos} escaños">
							{#if s.pct >= 12}
								<span class="seg-label" style="color:{tintaSobre(s.color)}">{s.escanos}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="tabla-scroll">
				<table class="tabla">
					<thead>
						<tr>
							<th class="th-left">Partido</th>
							<th>Votos</th>
							<th>%</th>
							<th>Dif. %</th>
							<th>Escaños</th>
							<th>Dif.</th>
						</tr>
					</thead>
					<tbody>
						{#each activa.principales as p (p.siglas)}
							{@const dif = p.escanosAnterior === null ? null : p.escanos - p.escanosAnterior}
							{@const difPct = p.pctVotosAnterior === null ? null : Math.round((p.pctVotos - p.pctVotosAnterior) * 100) / 100}
							<tr>
								<td>
									<div class="party-cell">
										<span class="swatch" style="background:{p.color}"></span>
										<span class="party-name">{p.siglas}</span>
									</div>
								</td>
								<td class="num">{formatMiles(p.votos)}</td>
								<td class="num">{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
								<td class="num">
									{#if difPct === null}
										<span class="dif sin-dato" title="No se presentó con esta marca en {CONVOCATORIA_ANTERIOR}, no es comparable">—</span>
									{:else}
										<span class="dif" class:up={difPct > 0} class:down={difPct < 0}>
											{difPct > 0 ? '+' : ''}{difPct.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
										</span>
									{/if}
								</td>
								<td class="num seats">{p.escanos}</td>
								<td class="num">
									{#if dif === null}
										<span class="dif sin-dato" title="No se presentó con esta marca en {CONVOCATORIA_ANTERIOR}, no es comparable">—</span>
									{:else}
										<span class="dif" class:up={dif > 0} class:down={dif < 0}>
											{dif > 0 ? '+' : ''}{dif}
										</span>
									{/if}
								</td>
							</tr>
						{/each}
						<!-- `otros` falta cuando la provincia se sostiene solo con la tabla
						     fija (sin datos de la jornada): ahí no hay nada que agregar. -->
						{#if activa.otros && activa.otros.numCandidaturas > 0}
							{@const otros = activa.otros}
							<tr class="fila-otros">
								<td>
									<div class="party-cell">
										<span class="swatch swatch-otros"></span>
										<span class="party-name">Otros ({otros.numCandidaturas})</span>
									</div>
								</td>
								<td class="num">{formatMiles(otros.votos)}</td>
								<td class="num">{otros.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%</td>
								<td class="num">—</td>
								<td class="num seats">—</td>
								<td class="num">—</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
			<p class="nota">Candidaturas con representación y principales minoritarias — {CONVOCATORIA}</p>
				{:else}
					<!-- Tabla de entrada: las 52 con su ganador, y cada fila hace lo mismo
					     que pulsar la provincia en el mapa. Es lo que permite llegar a una
					     provincia por su nombre y lo que hace la vista usable con teclado:
					     tabular por 52 polígonos de un SVG no es una forma de navegar. -->
					<p class="sub-kicker">Resultados por provincia</p>
					<!-- Lista y no `<table>`. Cada fila es **un solo botón** —tres paradas
					     de teclado por provincia serían 156— así que las celdas no son
					     celdas: son una rejilla dentro del botón. Con `<table>` había que
					     poner `colspan` y la cabecera no alineaba con nada. Aquí cabecera
					     y filas comparten la misma rejilla, así que alinean por
					     construcción. -->
					<div class="tabla-scroll indice-scroll">
						<div class="indice-cabecera">
							<span>Provincia</span>
							<span class="ic-fuerzas">Tres más votados — diputados</span>
						</div>
						<ul class="indice-lista">
							{#each listaProvincias as p (p.cod)}
								<li>
									<button
										type="button"
										class="fila-provincia"
										onclick={() => {
											codProvSel = p.cod;
											nivel = 'municipio';
											alCambiarDeNivel('municipio', p.cod);
										}}
									>
										<span class="fp-nombre">{p.nombre}</span>
										<span class="fp-fuerzas">
											{#if p.top.length}
												{#each p.top as t (t.siglas)}
													<span class="fp-fuerza">
														<span class="swatch" style="background:{t.color}"></span>
														<span class="fp-siglas">{t.siglas}</span>
														<span class="fp-dip">{t.escanos}</span>
													</span>
												{/each}
											{:else}
												<span class="fp-sin-dato">sin escrutar</span>
											{/if}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					</div>
					<p class="nota">
						Pulsa una provincia, aquí o en el mapa, para ver su reparto y sus municipios
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.panel {
		width: 100%;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
		text-align: center;
	}

	/* Una columna por defecto —el mapa primero y la tabla debajo— y dos en
	   cuanto hay sitio. El mapa pesa menos que la tabla (1fr contra 1,3fr):
	   la tabla lleva seis columnas de cifras y es lo que se viene a leer. */
	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 20px;
		align-items: start;
	}

	.col-mapa,
	.col-tabla {
		min-width: 0;
	}

	/* En móvil las dos columnas se apilan y la tabla queda fuera de pantalla al
	   pulsar en el mapa: sin esto parece que el clic no ha hecho nada. En
	   escritorio la tabla ya está a la vista, así que sobra. */
	.ir-a-tabla {
		display: block;
		width: 100%;
		margin-top: 10px;
		padding: 9px 12px;
		background: var(--paper);
		border: 1px solid var(--ink);
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.ir-a-tabla:hover {
		background: var(--c);
	}

	/* Popup del mapa. Caja de 190 px: la tabla del detalle no cabe ahí, así que
	   lleva sus propias medidas en vez de reutilizar `.tabla`. */
	.popup-tabla {
		width: 100%;
		border-collapse: collapse;
		font-size: 10.5px;
	}

	.popup-tabla th {
		padding: 0 0 3px;
		font-size: 9px;
		font-weight: 700;
		color: #9ca3af;
		text-align: right;
		white-space: nowrap;
	}

	.popup-estado {
		display: block;
		font-weight: 600;
		color: #6b7280;
		text-transform: none;
		letter-spacing: 0;
	}

	.popup-party {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 1px 0;
		white-space: nowrap;
	}

	.popup-num {
		padding: 1px 0 1px 8px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	/* Una sola definición de la rejilla, para que la cabecera y las 52 filas no
	   puedan desalinearse: si cambia el reparto, cambia en los dos sitios. */
	.indice-scroll {
		--rejilla-indice: minmax(0, 1fr) auto;
	}

	/* Cabecera pegajosa dentro del contenedor con scroll: con 52 filas, perder
	   los rótulos a la tercera provincia es perderlos del todo. Lleva fondo
	   propio o se transparenta sobre las filas que pasan por debajo. */
	.indice-cabecera {
		display: grid;
		grid-template-columns: var(--rejilla-indice);
		align-items: baseline;
		gap: 10px;
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 5px 8px 4px;
		background: var(--paper);
		border-bottom: 1px solid var(--border);
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.ic-fuerzas {
		text-align: right;
	}

	.indice-lista {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.fila-provincia {
		display: grid;
		grid-template-columns: var(--rejilla-indice);
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 7px 8px;
		background: none;
		border: none;
		font-family: var(--font-body);
		font-size: 12.5px;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.fila-provincia:hover {
		background: var(--accent-bg, rgba(1, 243, 179, 0.1));
	}

	.fp-nombre {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Las tres fuerzas, a la derecha y en el mismo orden que las ordena el
	   pipeline (por votos). Envuelven en móvil, donde el nombre ya se come el
	   ancho. */
	.fp-fuerzas {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 4px 10px;
		min-width: 0;
	}

	.fp-fuerza {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.fp-siglas {
		color: #6b7280;
		/* Las siglas largas no pueden empujar a las otras dos fuerzas fuera de la
		   fila: se recortan ellas. */
		max-width: 7.5em;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.fp-dip {
		font-weight: 800;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.fp-sin-dato {
		font-style: italic;
		color: #c4c4c0;
	}

	.sub-kicker {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 8px 0;
	}

	.prov-total-escanos {
		font-weight: 400;
		color: var(--grey);
	}

	.volver-muni {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--paper);
		border: 1.5px solid var(--ink);
		padding: 7px 12px;
		margin: 0 0 12px 0;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--ink);
		cursor: pointer;
		transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease, color 0.15s ease;
	}

	.volver-muni:hover {
		background: var(--c);
		color: var(--ink);
		box-shadow: var(--shadow-hard-lift);
		transform: translate(-2px, -2px);
	}

	.stats {
		list-style: none;
		margin: 0 0 12px 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px 16px;
	}

	.stats li {
		display: flex;
		justify-content: space-between;
		gap: 6px;
		font-family: var(--font-body);
		font-size: 12px;
	}

	.stat-label {
		color: var(--grey);
	}

	.stat-value {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.swatch {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
	}

	.placeholder {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		text-align: center;
		padding: 32px 0;
	}

	.barra-wrap {
		margin: 0 0 14px 0;
	}

	.barra {
		display: flex;
		width: 100%;
		height: 22px;
		overflow: hidden;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		border-right: 1px solid var(--border);
	}

	.seg:last-child {
		border-right: none;
	}

	.seg-label {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.tabla-scroll {
		width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-top: 1px solid var(--border);
	}

	.tabla {
		width: 100%;
		min-width: 320px;
		border-collapse: collapse;
	}

	.tabla thead tr {
		border-bottom: 1px solid var(--border);
	}

	.tabla th {
		padding: 4px 6px;
		text-align: center;
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grey);
	}

	.tabla th.th-left {
		text-align: left;
	}

	.tabla tbody tr {
		border-bottom: 1px solid var(--border);
	}

	.tabla tbody tr:hover {
		background: #fafafa;
	}

	.tabla td {
		padding: 5px 6px;
	}

	.fila-otros td {
		color: var(--grey);
	}

	.fila-otros .party-name {
		font-style: italic;
		color: var(--grey);
	}

	.swatch-otros {
		background: repeating-linear-gradient(45deg, #c7cacd, #c7cacd 2px, transparent 2px, transparent 4px);
	}

	.party-cell {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.party-name {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink);
	}

	.num {
		text-align: center;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--grey);
		font-variant-numeric: tabular-nums;
	}

	.num.seats {
		font-size: 12px;
		font-weight: 700;
		color: var(--ink);
	}

	.dif {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--grey);
	}

	.dif.up {
		color: #0a7a4a;
	}

	.dif.down {
		color: var(--stamp);
	}

	.nota {
		font-size: 9px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 6px 0 0 0;
		text-align: center;
	}

	@media (min-width: 720px) {
		.layout {
			grid-template-columns: 1fr 1.3fr;
		}

		.ir-a-tabla {
			display: none;
		}

		/* La tabla de las 52 al alto del mapa, con su propio scroll. `--alto-mapa`
		   lo mide el componente; si todavía no está medido no hay tope, que es
		   mejor que un salto al primer pintado. */
		.indice-scroll {
			max-height: var(--alto-mapa, none);
			overflow-y: auto;
		}
	}
</style>
