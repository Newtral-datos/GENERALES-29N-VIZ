<script lang="ts">
	import { resolve, asset } from '$app/paths';
	import { getResultados, type Provincia, type UltimoEscano } from '#lib/data';
	import { CONVOCATORIA } from '#lib/config';
	import { formatMiles } from '#lib/format';
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection } from '#lib/geo';
	import { tintaDeMarca } from '#lib/color';

	type PropsProv = { name: string; cod_prov: string; cod_ccaa: string; ccaa: string };
	type Feature = GeoFeature<PropsProv>;

	// Canarias no se proyecta en su sitio real: deja medio lienzo de océano
	// vacío. Va en su propia franja debajo, como en el resto de los mapas del
	// panel (ver AGENTS.md, "Mapas coropléticos").
	const CANARIAS = new Set(['35', '38']);
	const GRIS_DECIDIDA = '#DCDCD8';

	type Batalla = UltimoEscano & {
		cod: string;
		nombre: string;
		pctEscrutado?: number;
		// Qué parte de los votos que quedan por contar necesita el aspirante.
		// Es la clave de orden, no el hueco a secas: con el hueco solo,
		// Barcelona y Madrid —de las más vivas— se caen del ranking.
		esfuerzo: number;
		alcanzable: boolean;
	};

	let provincias = $state<Record<string, Provincia> | null>(null);

	$effect(() => {
		getResultados().then((d) => {
			provincias = d.provincias;
		});
	});

	let batallas = $derived.by<Batalla[]>(() => {
		if (!provincias) return [];
		const lista: Batalla[] = [];
		for (const [cod, p] of Object.entries(provincias)) {
			const u = p.ultimoEscano;
			if (!u) continue;
			// Sin votos por contar el esfuerzo es infinito, no cero: la batalla
			// está decidida, que es lo contrario de estar al alcance.
			const esfuerzo = u.censoSinEscrutar > 0 ? u.votosFaltantes / u.censoSinEscrutar : Infinity;
			lista.push({
				...u,
				cod,
				nombre: p.nombre,
				pctEscrutado: p.pctEscrutado,
				esfuerzo,
				alcanzable: esfuerzo <= 1
			});
		}
		return lista.sort((a, b) => a.esfuerzo - b.esfuerzo || a.votosFaltantes - b.votosFaltantes);
	});

	let abiertas = $derived(batallas.filter((b) => b.alcanzable).length);
	let masAjustada = $derived(batallas[0]);

	let porCod = $derived(new Map(batallas.map((b) => [b.cod, b])));

	// El nombre sale del JSON de resultados aunque la provincia no tenga aún
	// datos de último escaño: el mapa la dibuja igual y hay que poder nombrarla.
	function nombreDe(cod: string): string {
		return provincias?.[cod]?.nombre ?? cod;
	}

	// El mapa pinta **el color del aspirante**, no el del que tiene el escaño.
	// Un mapa de ganadores ya está en la portada; lo que este añade es la
	// geografía de quién está a punto de arrebatar algo. Las provincias donde el
	// escaño ya está decidido van en gris: no son un cero, están fuera de
	// juego.
	function colorDe(cod: string): string {
		const b = porCod.get(cod);
		if (!b || !b.alcanzable) return GRIS_DECIDIDA;
		return b.aspirante.color;
	}

	let features = $state<Feature[] | null>(null);

	$effect(() => {
		fetch(asset('data/provincias.geojson'), { cache: 'no-cache' })
			.then((r) => r.json())
			.then((d: FeatureCollection<PropsProv>) => {
				features = d.features;
			})
			.catch(() => {
				// Que falte la geometría no puede dejar la página en blanco: la
				// lista es la pieza principal y se sostiene sola.
				features = [];
			});
	});

	const SIZE = 420;
	const INSET_W = SIZE * 0.3;
	const INSET_H = SIZE * 0.18;
	const INSET_X = SIZE * 0.04;
	const INSET_GAP = SIZE * 0.035;

	let peninsula = $derived((features ?? []).filter((f) => !CANARIAS.has(f.properties.cod_prov)));
	let canarias = $derived((features ?? []).filter((f) => CANARIAS.has(f.properties.cod_prov)));

	let mainBounds = $derived(computeBounds(peninsula));
	let mainVp = $derived(mainBounds ? fitBox(mainBounds, SIZE, SIZE) : { w: SIZE, h: SIZE });
	let canaryBounds = $derived(computeBounds(canarias));
	let canaryFit = $derived(canaryBounds ? fitBox(canaryBounds, INSET_W, INSET_H) : { w: 0, h: 0 });
	let insetY = $derived(mainVp.h + INSET_GAP);
	let totalH = $derived(mainVp.h + INSET_GAP + INSET_H);
	let canaryOffset = $derived({
		x: INSET_X + (INSET_W - canaryFit.w) / 2,
		y: insetY + (INSET_H - canaryFit.h) / 2
	});

	// Cuántas marcas se nombran en la leyenda antes de agrupar. Con el escrutinio
	// avanzado son 7; al principio de la noche puede haber muchas más, y
	// entonces sí hay que cortar. El corte va por nº de provincias, nunca
	// escondiendo "las que solo pintan una": agrupar por ahí se llevaba por
	// delante justo los colores más distintivos (JxCAT, BNG, Teruel Existe),
	// que son los que no se pueden identificar sin leyenda.
	const MARCAS_EN_LEYENDA = 8;

	// Las marcas que aparecen como aspirantes, para la leyenda. Solo las que
	// pintan algo: una leyenda con las 36 del catálogo no identificaría nada.
	let aspirantes = $derived.by(() => {
		const cuenta = new Map<string, { siglas: string; color: string; n: number }>();
		for (const b of batallas) {
			if (!b.alcanzable) continue;
			const k = b.aspirante.siglas;
			const e = cuenta.get(k) ?? { siglas: k, color: b.aspirante.color, n: 0 };
			e.n += 1;
			cuenta.set(k, e);
		}
		return [...cuenta.values()].sort((a, b) => b.n - a.n);
	});

	// Dos estados distintos y no uno: `activa` es el hover, que va y viene con el
	// ratón, y `seleccionada` es el clic, que tiene que quedarse. Con una sola
	// variable, al apartar el ratón después de pulsar se borraba el resaltado de
	// la fila a la que acababas de llegar.
	let activa = $state<string | null>(null);
	let seleccionada = $state<string | null>(null);

	// Lo que mira el pie: manda el hover si lo hay, y si no, lo último pulsado.
	let enfocada = $derived(activa ?? seleccionada);

	// Al pulsar una provincia se va a su fila en vez de abrir un popup propio:
	// la fila ya lo cuenta todo y así el mapa y la lista son la misma pieza.
	function irALaFila(cod: string) {
		seleccionada = cod;
		const el = document.getElementById(`batalla-${cod}`);
		// `block: 'center'` y no 'start': la fila mide cuatro líneas y pegada al
		// borde superior se lee como si fuera la primera de la lista.
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<main class="main">
	<a href={resolve('/')} class="volver">← Volver al Congreso</a>

	<div class="intro">
		<p class="kicker">La batalla por el último escaño</p>
		<h1 class="titulo">Dónde se decide un escaño por unos pocos votos</h1>
	</div>

	{#if provincias === null}
		<p class="aviso">Cargando datos…</p>
	{:else if batallas.length === 0}
		<p class="aviso">
			La batalla por el último escaño se puede seguir en cuanto empiece el escrutinio.
			Mientras no haya votos contados no hay nada en disputa.
		</p>
	{:else}
		<section class="resumen">
			<div class="dato">
				<!-- Antetítulo vacío a propósito: reserva el mismo hueco que el
				     "FALTAN" de la caja de al lado para que las dos cifras queden a
				     la misma altura, que es lo que permite compararlas de un vistazo.
				     `aria-hidden` porque no dice nada que haya que leer. -->
				<span class="dato-antetitulo" aria-hidden="true"></span>
				<span class="dato-cifra">{abiertas}</span>
				<span class="dato-label">
					{abiertas === 1 ? 'escaño en disputa' : 'escaños en disputa'}
				</span>
			</div>
			{#if masAjustada}
				<div class="dato">
					<span class="dato-antetitulo">Faltan</span>
					<span class="dato-cifra">{formatMiles(masAjustada.votosFaltantes)}</span>
					<span class="dato-label">votos en la más ajustada</span>
					<span class="dato-nota">{masAjustada.nombre}</span>
				</div>
			{/if}
		</section>

		{#if features && features.length && mainBounds}
			<section class="mapa-bloque">
				<p class="mapa-rotulo">Quién puede arrebatar un escaño</p>
				<div class="mapa-cuerpo">
					<svg viewBox="0 0 {mainVp.w} {totalH}" class="mapa" role="img"
						aria-label="Mapa de España por provincias: coloreadas con el partido que puede arrebatar el último escaño, en gris las que ya están decididas">
						{#each peninsula as f (f.properties.cod_prov)}
							{#each featurePaths(f, mainBounds, mainVp.w, mainVp.h) as d, i (i)}
								<path
									{d}
									fill={colorDe(f.properties.cod_prov)}
									stroke="#fff"
									stroke-width="0.6"
									class="prov"
									class:activa={activa === f.properties.cod_prov ||
										seleccionada === f.properties.cod_prov}
									class:sin-batalla={!porCod.get(f.properties.cod_prov)?.alcanzable}
									role="button"
									tabindex="0"
									aria-label={f.properties.name}
									onmouseenter={() => (activa = f.properties.cod_prov)}
									onmouseleave={() => (activa = null)}
									onclick={() => irALaFila(f.properties.cod_prov)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											irALaFila(f.properties.cod_prov);
										}
									}}
								/>
							{/each}
						{/each}

						{#if canaryBounds}
							<text x={INSET_X} y={insetY + 8} class="inset-label">Canarias</text>
							{#each canarias as f (f.properties.cod_prov)}
								{#each featurePaths(f, canaryBounds, canaryFit.w, canaryFit.h, canaryOffset.x, canaryOffset.y) as d, i (i)}
									<path
										{d}
										fill={colorDe(f.properties.cod_prov)}
										stroke="#fff"
										stroke-width="0.6"
										class="prov"
										class:activa={activa === f.properties.cod_prov ||
										seleccionada === f.properties.cod_prov}
										class:sin-batalla={!porCod.get(f.properties.cod_prov)?.alcanzable}
										role="button"
										tabindex="0"
										aria-label={f.properties.name}
										onmouseenter={() => (activa = f.properties.cod_prov)}
										onmouseleave={() => (activa = null)}
										onclick={() => irALaFila(f.properties.cod_prov)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												irALaFila(f.properties.cod_prov);
											}
										}}
									/>
								{/each}
							{/each}
						{/if}
					</svg>

					<div class="mapa-leyenda">
						<!-- Leyenda obligatoria: con colores de partido, la identidad no
						     puede depender solo del color. Las que pintan una sola
						     provincia se agrupan: una fila por marca sería una lista de
						     colores indistinguibles. -->
						{#each aspirantes.slice(0, MARCAS_EN_LEYENDA) as a (a.siglas)}
							<span class="leyenda-fila">
								<span class="swatch" style="background:{a.color}"></span>
								<span class="leyenda-siglas">{a.siglas}</span>
								<span class="leyenda-n">{a.n}</span>
							</span>
						{/each}
						{#if aspirantes.length > MARCAS_EN_LEYENDA}
							<span class="leyenda-fila">
								<span class="swatch swatch--varias"></span>
								<span class="leyenda-siglas">
									Otras ({aspirantes.length - MARCAS_EN_LEYENDA})
								</span>
								<span class="leyenda-n">
									{aspirantes.slice(MARCAS_EN_LEYENDA).reduce((t, a) => t + a.n, 0)}
								</span>
							</span>
						{/if}
						<span class="leyenda-fila">
							<span class="swatch" style="background:{GRIS_DECIDIDA}"></span>
							<span class="leyenda-siglas">Sin batalla</span>
							<span class="leyenda-n">{batallas.length - abiertas}</span>
						</span>
					</div>
				</div>
				<!-- Un pie que cambia al pasar por encima, en vez de un popup
				     flotante: da la identidad de la provincia sin tener que calcular
				     posiciones ni voltear contra el borde de la pantalla, y en táctil
				     —donde no hay hover— el toque lleva a la fila, que lo cuenta todo. -->
				<!-- El centrado vertical va en el contenedor, NO en el párrafo: con
				     `display:flex` en el <p>, cada trozo de texto se vuelve un item
				     anónimo y los espacios entre elementos desaparecen — salía
				     "decidido paraPP" pegado. -->
				<div class="mapa-pie-caja" class:vacio={!enfocada || !porCod.get(enfocada)}>
					<p class="mapa-pie" aria-live="polite">
						{#if enfocada && porCod.get(enfocada)}
							{@const b = porCod.get(enfocada)!}
							<strong>{b.nombre}</strong> —
							{#if b.alcanzable}
								a <span class="marca" style="color:{tintaDeMarca(b.aspirante.color)}"
									>{b.aspirante.siglas}</span
								> le faltan <span class="pie-votos">{formatMiles(b.votosFaltantes)}</span> votos
								para quitarle el escaño a
								<span class="marca" style="color:{tintaDeMarca(b.tiene.color)}"
									>{b.tiene.siglas}</span
								>
							{:else}
								<!-- "No hay batalla" y no "el escaño está decidido": con el voto
								     exterior pendiente, decir que algo está decidido afirma más de
								     lo que el dato sabe. Esto dice solo lo que se ve. -->
								no hay batalla por el último escaño
							{/if}
						{:else if enfocada}
							<!-- La provincia existe en el mapa pero todavía no tiene el dato:
							     a mitad de recuento unas lo traen y otras no. No es "no hay
							     batalla", es que aún no se sabe. -->
							<strong>{nombreDe(enfocada)}</strong> — todavía sin datos del último escaño
						{:else}
							Cada provincia va del color de quien puede arrebatar el escaño, no del color
							de quien lo tiene. Toca una para ir a su detalle.
						{/if}
					</p>
				</div>
			</section>
		{/if}

		<ol class="lista">
			{#each batallas as b (b.cod)}
				<li
					id="batalla-{b.cod}"
					class="fila"
					class:fuera={!b.alcanzable}
					class:resaltada={seleccionada === b.cod}
				>
					<div class="fila-cabeza">
						<span class="prov">{b.nombre}</span>
						{#if b.pctEscrutado != null}
							<span class="escrut">{b.pctEscrutado.toFixed(1)} % escrutado</span>
						{/if}
					</div>

					<!-- El perseguidor va primero y la flecha apunta a su presa, que es
					     el orden en que se cuenta la historia. El número de votos va
					     destacado al final de la fila, en su columna: es la cifra que se
					     compara entre provincias, así que alineada a la derecha se puede
					     recorrer la lista en vertical sin saltos. -->
					<div class="fila-duelo">
						<span class="duelo-bandos">
							<span class="bando">
								<span class="swatch" style="background:{b.aspirante.color}"></span>
								<span class="siglas" style="color:{tintaDeMarca(b.aspirante.color)}">
									{b.aspirante.siglas}
								</span>
							</span>
							<span class="flecha" aria-hidden="true">→</span>
							<span class="bando">
								<span class="swatch" style="background:{b.tiene.color}"></span>
								<span class="siglas" style="color:{tintaDeMarca(b.tiene.color)}">
									{b.tiene.siglas}
								</span>
								<span class="rol">tiene el escaño</span>
							</span>
						</span>
						<span class="hueco">
							<span class="hueco-cifra">{formatMiles(b.votosFaltantes)}</span>
							<span class="hueco-label">votos le faltan</span>
						</span>
					</div>

					<!-- La barra es parte-sobre-total: el ancho completo son los votos que
					     quedan por contar y el relleno, el hueco que hay que remontar. Así
					     se ve de un vistazo si el hueco cabe en lo que falta, que es la
					     pregunta de verdad. -->
					<div class="medida">
						<div
							class="barra"
							role="img"
							aria-label="A {b.aspirante.siglas} le faltan {formatMiles(
								b.votosFaltantes
							)} votos para quitarle el escaño a {b.tiene.siglas}, y quedan {formatMiles(
								b.censoSinEscrutar
							)} votos por contar"
						>
							<i
								style="width:{Math.min(b.esfuerzo, 1) * 100}%;background:{b.aspirante.color}"
							></i>
						</div>
						<span class="cifras">de {formatMiles(b.censoSinEscrutar)} por contar</span>
					</div>

					{#if !b.alcanzable}
						<p class="veredicto">
							{#if b.censoSinEscrutar === 0}
								Sin votos por contar: el escaño está decidido.
							{:else}
								Le faltan más votos de los que quedan por contar.
							{/if}
						</p>
					{/if}
				</li>
			{/each}
		</ol>

	{/if}
</main>

<style>
	.main {
		padding: 20px 24px 32px;
		max-width: 760px;
		margin: 0 auto;
		min-width: 0;
	}

	/* Mismo botón que /pactos, /provincias y /participacion: las cuatro vistas
	   se alcanzan desde un teaser de la portada y tienen que volver igual. */
	.volver {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
		text-decoration: none;
		border: 1px solid var(--ink);
		padding: 7px 12px;
		margin-bottom: 16px;
		background: var(--paper);
		transition: background 0.15s ease;
	}

	.volver:hover {
		background: var(--c);
	}

	.intro {
		text-align: center;
		margin-bottom: 20px;
	}

	.kicker {
		margin: 0 0 4px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--cd, #00b38a);
	}

	.titulo {
		margin: 0 0 8px;
		font-size: 26px;
		line-height: 1.15;
	}


	.aviso {
		margin: 0;
		padding: 28px 16px;
		text-align: center;
		font-size: 12px;
		color: #9ca3af;
		background: #fff;
		border: 1px solid #e5e7eb;
	}

	/* Dos cifras de contexto antes de la lista: cuántas batallas están de verdad
	   abiertas y cuál es la más ajustada. */
	.resumen {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0;
		margin-bottom: 16px;
		background: #fff;
		border: 1px solid #e5e7eb;
	}

	/* Apiladas y centradas en vez de en fila: con el número al lado de dos
	   líneas de texto, el `align-items: baseline` no alineaba nada —el label era
	   a su vez una columna— y las etiquetas largas envolvían contra la cifra. */
	.dato {
		display: flex;
		flex-direction: column;
		align-items: center;
		/* Desde arriba y no centrado: con el antetítulo reservado en las dos, así
		   las cifras arrancan exactamente a la misma altura aunque una caja tenga
		   una línea más al pie. */
		justify-content: flex-start;
		gap: 3px;
		padding: 16px 14px 18px;
		text-align: center;
		min-width: 0;
	}

	.dato-antetitulo {
		min-height: 1em;
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		line-height: 1;
		color: #9ca3af;
	}

	.dato + .dato {
		border-left: 1px solid #f0f0f0;
	}

	/* La cifra sobre el teal corporativo, como un subrayado de rotulador. Tinta
	   oscura y no blanca: el teal es muy luminoso y el blanco encima se queda en
	   1,4:1 — la oscura da 12,8:1. Es el mismo criterio que `tintaSobre()` de
	   #lib/color, aquí resuelto a mano porque el fondo es fijo. */
	.dato-cifra {
		display: inline-block;
		padding: 2px 10px 3px;
		background: var(--c, #01f3b3);
		font-size: 34px;
		font-weight: 800;
		line-height: 1.05;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		color: var(--ink, #0a0e14);
	}

	.dato-label {
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		line-height: 1.25;
		color: #6b7280;
	}

	.dato-nota {
		font-size: 11.5px;
		line-height: 1.2;
		color: #9ca3af;
	}

	/* Sin card: el mapa va sobre el fondo de la página. Es la pieza secundaria
	   —responde "dónde" y la lista responde "cuánto"— y envolverlo en el
	   "chrome" de tarjeta del workspace le daba más peso del que tiene. El
	   rótulo usa el mismo sistema tipográfico que el kicker de la cabecera de
	   esta vista, no una franja propia. */
	.mapa-bloque {
		margin-bottom: 22px;
		min-width: 0;
	}

	.mapa-rotulo {
		margin: 0 0 12px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--cd, #00b38a);
		text-align: center;
	}

	.mapa-cuerpo {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 24px;
		min-width: 0;
	}

	.mapa {
		width: 100%;
		max-width: 340px;
		height: auto;
		flex: 1;
		min-width: 0;
	}

	.prov {
		cursor: pointer;
		transition: opacity 0.1s ease;
	}

	.prov:hover,
	.prov.activa {
		/* El filete oscuro, no un cambio de color: el color es el dato. */
		stroke: var(--ink, #0a0e14);
		stroke-width: 1.2;
	}

	.prov:focus-visible {
		outline: none;
		stroke: var(--ink, #0a0e14);
		stroke-width: 1.6;
	}

	/* Las decididas no invitan a pulsar tanto como las que están en juego. */
	.prov.sin-batalla {
		cursor: default;
	}

	.inset-label {
		font-size: 7px;
		font-style: italic;
		fill: #9ca3af;
	}

	.mapa-leyenda {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex: none;
		min-width: 0;
	}

	.leyenda-fila {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10.5px;
	}

	.leyenda-siglas {
		flex: 1;
		min-width: 0;
		color: #6b7280;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.leyenda-n {
		flex: none;
		color: #9ca3af;
		font-variant-numeric: tabular-nums;
	}

	/* Mezcla de colores para la fila "Otras": un gris no serviría, se
	   confundiría con el de "ya decidido". */
	.swatch--varias {
		background: linear-gradient(135deg, #0557A1 0 33%, #E10819 33% 66%, #02C119 66% 100%);
	}

	/* El pie es donde se lee el dato de la provincia marcada, así que tiene
	   cuerpo de texto de verdad y no de nota al pie. Alto fijo: cambia al pasar
	   por encima y sin reservarle sitio la lista entera daría un salto en cada
	   movimiento del ratón. */
	/* El flex vive aquí, en el contenedor, para centrar verticalmente sin
	   romper el flujo de texto del párrafo. */
	.mapa-pie-caja {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 14px 0 0;
		padding: 10px 14px;
		min-height: 4.2em;
		background: #fafaf9;
		border-top: 1px solid #ececeb;
		border-bottom: 1px solid #ececeb;
	}

	/* Sin provincia marcada es solo la explicación: recesivo, para que no
	   compita con el dato cuando lo haya. */
	.mapa-pie-caja.vacio {
		background: transparent;
		border-color: transparent;
	}

	.mapa-pie {
		margin: 0;
		font-size: 14px;
		line-height: 1.4;
		color: #6b7280;
		text-align: center;
	}

	.mapa-pie-caja.vacio .mapa-pie {
		font-size: 11px;
		font-style: italic;
		color: #9ca3af;
	}

	.mapa-pie strong {
		color: var(--ink, #0a0e14);
		font-weight: 700;
	}

	/* El nombre del partido, en su propio color. Pasa por `tintaDeMarca` y no
	   por el color del catálogo a secas: 11 de los 19 colores no llegan a 4,5:1
	   como texto sobre el papel (CCa 1,45:1, ERC 1,71:1, VOX 2,33:1). */
	.marca {
		font-weight: 800;
		white-space: nowrap;
	}

	.pie-votos {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: var(--ink, #0a0e14);
	}

	.lista {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.fila {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-top: none;
		padding: 12px 16px;
		min-width: 0;
	}

	.fila:first-child {
		border-top: 1px solid #e5e7eb;
		border-left: 3px solid var(--c, #01f3b3);
	}

	/* Las que ya no están al alcance siguen en la lista —son información, no
	   ruido— pero recesivas: lo interesante está arriba. */
	.fila.fuera {
		background: #fcfcfc;
	}

	/* Al llegar desde el mapa, la fila se señala: si no, el scroll deja al
	   lector en medio de una lista de 52 sin saber a cuál ha venido. */
	.fila.resaltada {
		background: var(--accent-bg, rgba(1, 243, 179, 0.1));
		box-shadow: inset 3px 0 0 var(--cd, #00b38a);
	}

	.fila.fuera .prov {
		color: #6b7280;
	}

	.fila-cabeza {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 8px;
	}

	.prov {
		font-size: 14px;
		font-weight: 700;
		color: var(--ink, #0a0e14);
	}

	.escrut {
		font-size: 10px;
		color: #9ca3af;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.fila-duelo {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
		min-width: 0;
	}

	/* Los dos bandos envuelven si hace falta; la cifra de la derecha no. */
	.duelo-bandos {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		min-width: 0;
	}

	.bando {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.swatch {
		width: 10px;
		height: 10px;
		flex: none;
		/* Filete neutro: con 36 colores de partido en juego, los más claros del
		   catálogo (EH Bildu, ERC) desaparecen sobre blanco en una marca de
		   10 px. No toca el color del partido. */
		border: 1px solid rgba(10, 14, 20, 0.2);
	}

	/* El nombre del partido va en su propio color, pasado por `tintaDeMarca`:
	   el color del catálogo a secas no se puede leer como texto (11 de 19
	   colores por debajo de 4,5:1). La muestra de al lado sí lleva el color
	   exacto, que es donde la identidad tiene que ser fiel. */
	.siglas {
		font-size: 12.5px;
		font-weight: 700;
	}

	/* En las decididas el color se apaga: lo interesante está arriba. */
	.fila.fuera .siglas {
		color: #6b7280 !important;
	}

	.rol {
		font-size: 10px;
		color: #9ca3af;
		white-space: nowrap;
	}

	.flecha {
		color: #c4c4c0;
		font-size: 13px;
		flex: none;
	}

	/* La cifra, destacada y en su columna a la derecha. Es el dato que se
	   compara entre provincias: alineada al borde y con cifras tabulares, la
	   lista se puede recorrer en vertical sin que los números bailen. */
	.hueco {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0;
		flex: none;
		margin-left: auto;
		padding-left: 12px;
		text-align: right;
	}

	.hueco-cifra {
		font-size: 19px;
		font-weight: 800;
		line-height: 1.05;
		color: var(--ink, #0a0e14);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.hueco-label {
		font-size: 9.5px;
		letter-spacing: 0.02em;
		color: #9ca3af;
		white-space: nowrap;
	}

	.fila.fuera .hueco-cifra {
		color: #6b7280;
		font-weight: 700;
	}

	.medida {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.barra {
		flex: 1;
		min-width: 0;
		height: 6px;
		background: #ececeb;
	}

	.barra i {
		display: block;
		height: 100%;
	}

	.cifras {
		flex: none;
		font-size: 11px;
		color: #6b7280;
		font-variant-numeric: tabular-nums;
	}

	.veredicto {
		margin: 6px 0 0;
		font-size: 10.5px;
		font-style: italic;
		color: #9ca3af;
	}




	@media (max-width: 640px) {
		.main {
			padding: 14px 14px 24px;
		}

		.titulo {
			font-size: 21px;
		}

		/* Las dos cifras se quedan en la misma fila también en móvil: son el
		   dato que se compara de un vistazo y apiladas pierden ese paralelismo.
		   A 375 px cada caja se queda en ~160 px de contenido, así que lo que
		   se encoge es la tipografía, no el número de columnas. */
		.dato {
			padding: 12px 6px 14px;
			gap: 2px;
		}

		.dato-antetitulo {
			font-size: 8.5px;
			letter-spacing: 0.08em;
		}

		.dato-cifra {
			padding: 2px 7px 3px;
			font-size: 26px;
		}

		.dato-label {
			font-size: 8.5px;
			letter-spacing: 0.05em;
		}

		.dato-nota {
			font-size: 10.5px;
		}

		/* A 375 px el mapa y su leyenda no caben al lado: la leyenda baja y se
		   reparte en filas, que con 4-5 entradas cabe en dos líneas. */
		.mapa-cuerpo {
			flex-direction: column;
			gap: 12px;
		}

		.mapa {
			max-width: 260px;
		}

		.mapa-leyenda {
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: center;
			gap: 4px 12px;
		}

		.leyenda-siglas {
			flex: none;
		}

		/* A 375 px "SENADO DE PROGRESO → JxCAT - JUNTS" ya ocupa el ancho, así
		   que la cifra se pone en su propia línea alineada a la derecha en vez
		   de competir por el hueco. */
		.fila-duelo {
			flex-direction: column;
			align-items: stretch;
			gap: 6px;
		}

		.hueco {
			flex-direction: row;
			align-items: baseline;
			gap: 5px;
			margin-left: 0;
			padding-left: 0;
			justify-content: flex-end;
		}

		.hueco-cifra {
			font-size: 17px;
		}

		.medida {
			flex-direction: column;
			align-items: stretch;
			gap: 6px;
		}

		.cifras {
			text-align: right;
		}
	}
</style>
