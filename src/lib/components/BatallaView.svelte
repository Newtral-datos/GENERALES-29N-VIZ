<script lang="ts">
	import { resolve, asset } from '$app/paths';
	import { getResultados, type Provincia, type UltimoEscano } from '#lib/data';
	import { CONVOCATORIA, ESCRUTINIO_BATALLA_FIABLE } from '#lib/config';
	import { formatAprox, formatMiles } from '#lib/format';
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection } from '#lib/geo';
	import { tintaDeMarca, tintaSobre } from '#lib/color';

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
	let pctEscrutado = $state<number | null>(null);

	$effect(() => {
		getResultados().then((d) => {
			provincias = d.provincias;
			pctEscrutado = d.nacional.pctEscrutado ?? null;
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

	let fueraDeAlcance = $derived(batallas.filter((b) => !b.alcanzable).length);
	let masAjustada = $derived(batallas[0]);
	// Las tres de cabecera. Solo las que siguen al alcance: una provincia
	// decidida no es "reñida" por mucho que su hueco sea pequeño, y la lista ya
	// viene ordenada por esfuerzo.
	let masRenidas = $derived(batallas.filter((b) => b.alcanzable).slice(0, 3));
	let censoPendiente = $derived(batallas.reduce((t, b) => t + b.censoSinEscrutar, 0));
	// Por debajo de este escrutinio el ranking es cierto pero volátil (ver el
	// porqué en #lib/config). El umbral está ahí para poder moverlo la noche
	// electoral sin tocar este componente.
	let asentado = $derived(pctEscrutado != null && pctEscrutado >= ESCRUTINIO_BATALLA_FIABLE);
	let enDisputa = $derived(batallas.filter((b) => b.alcanzable).length);

	let porCod = $derived(new Map(batallas.map((b) => [b.cod, b])));

	/**
	 * La proporción que ordena la lista, en la unidad que publica la nota del pie:
	 * cuántos votos le faltan al aspirante de cada mil electores pendientes.
	 *
	 * "Por mil" y no porcentaje: la proporción arranca en 1,1 por mil, así que en
	 * porcentaje serían todas "0,0 %" y no distinguirían nada.
	 */
	function formatPorMil(esfuerzo: number): string {
		if (!Number.isFinite(esfuerzo)) return '—';
		const porMil = esfuerzo * 1000;
		// Un decimal mientras signifique algo; con tres dígitos ya no aporta.
		return (porMil >= 100 ? Math.round(porMil).toString() : porMil.toFixed(1)).replace('.', ',');
	}

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

	{#if provincias === null}
		<p class="aviso">Cargando datos…</p>
	{:else if batallas.length === 0}
		<p class="aviso">
			La batalla por el último escaño se puede seguir en cuanto empiece el escrutinio.
			Mientras no haya votos contados no hay nada en disputa.
		</p>
	{:else}
		<!-- Titular fijo y entradilla. El antetítulo se va: con el titular diciendo
		     "las batallas por el último escaño", repetirlo encima en versalitas era
		     decir dos veces lo mismo.

		     Aquí hubo antes un titular construido con el dato del envío ("En Navarra,
		     167 votos separan a..."). Suena a directo, pero convierte la cabecera en
		     un titular que cambia solo cada minuto y le quita el sitio a la pieza que
		     ya cuenta eso bien, que es la tira de las tres más reñidas de abajo. El
		     titular nombra la sección; el dato lo dan las piezas.

		     El "en directo" va de antetítulo, con el punto teal y el latido de la
		     casa (ver EscrutinioHeader). Es el único indicador de directo de la
		     página: el sello rojo que tenía la tira se quitó para no decirlo dos
		     veces. -->
		<section class="portada">
			<p class="portada-directo">
				<i class="portada-punto" aria-hidden="true"></i>en directo
			</p>
			<h1 class="portada-titular">Las batallas por el último escaño</h1>

			<!-- Aquí había una entradilla en prosa con el escrutinio y el censo
			     pendiente. Fuera: decía exactamente lo mismo que el aviso que hay unas
			     líneas más abajo, encima del mapa (`.aviso-escrutinio`), que además es
			     su sitio natural porque es donde el lector va a interpretar las cifras.

			     Lo único que se queda es el recuento de escaños en disputa, y solo con
			     el escrutinio asentado: por debajo de ese umbral no se publica (serían
			     las 52 provincias) y por encima no está en ninguna otra pieza. -->
			{#if asentado}
				<p class="portada-dato">
					<strong>{enDisputa}</strong>
					{enDisputa === 1 ? 'escaño sigue en disputa' : 'escaños siguen en disputa'} de
					{batallas.length} provincias
				</p>
			{/if}
		</section>

		<!-- Las tres de cabecera, antes del mapa y de la lista de 52: el titular de
		     la vista es "dónde se decide un escaño por unos pocos votos", y eso
		     son estas tres. Va sobre el fondo de la página y sin card, como el
		     mapa: es cabecera, no una pieza más.

		     El partido que tiene el escaño va primero y nombrado ("en cabeza"),
		     al contrario que en las filas de la lista —donde manda el
		     perseguidor—, así que la dirección se dice con palabras y no con una
		     flecha: dos convenciones opuestas en la misma pantalla se leen mal. -->
		{#if masRenidas.length}
			<section class="renidas">
				<!-- Título de sección con filete a la derecha, como un título de
				     sección de periódico: flush a la izquierda, en la caja del texto y
				     en caja baja. Aquí había un antetítulo de 9 px en versalitas con
				     tracking ancho y CENTRADO, que es el mismo que llevaban el mapa, la
				     nota y la portada — cuatro idénticos bajando la página.

				     Sin marca de directo: la lleva el titular de la portada, y decirlo
				     dos veces en la misma pantalla lo debilita. -->
				<h2 class="seccion">
					<span class="seccion-texto">Las más disputadas</span>
				</h2>
				<ol class="renidas-lista">
					{#each masRenidas as b, i (b.cod)}
						<li>
							<button type="button" class="renida" onclick={() => irALaFila(b.cod)}>
								<span class="renida-puesto" aria-hidden="true">{i + 1}</span>
								<span class="renida-cuerpo">
									<span class="renida-prov">{b.nombre}</span>
									<!-- Las mismas pastillas y la misma frase que las filas de la
									     lista. Antes esto era otro idioma —muestras de color,
									     siglas en texto coloreado y los rótulos "en cabeza / le
									     persigue"—, así que la misma información se contaba de dos
									     maneras en la misma página. -->
									<span class="renida-duelo">
										<span
											class="chip chip--mini"
											style="background:{b.aspirante.color};color:{tintaSobre(
												b.aspirante.color
											)}">{b.aspirante.siglas}</span>
										puede quitarle el escaño a
										<span
											class="chip chip--mini"
											style="background:{b.tiene.color};color:{tintaSobre(b.tiene.color)}"
											>{b.tiene.siglas}</span>
									</span>
								</span>
								<span class="renida-hueco">
									<span class="renida-cifra">{formatMiles(b.votosFaltantes)}</span>
									<span class="renida-label">
										{b.votosFaltantes === 1 ? 'voto' : 'votos'} de hueco
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		{#if !asentado && pctEscrutado != null}
			<p class="aviso-escrutinio">
				Con el {pctEscrutado.toFixed(1).replace('.', ',')} % escrutado casi todos los
				últimos escaños siguen en juego: queda mucho voto por contar. Estas cifras se moverán mucho.
			</p>
		{/if}

		{#if features && features.length && mainBounds}
			<section class="mapa-bloque">
				<h2 class="seccion">
					<span class="seccion-texto">Quién puede arrebatar un escaño</span>
				</h2>
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
						{#if fueraDeAlcance}
							<span class="leyenda-fila">
								<span class="swatch" style="background:{GRIS_DECIDIDA}"></span>
								<span class="leyenda-siglas">Sin batalla</span>
								<span class="leyenda-n">{fueraDeAlcance}</span>
							</span>
						{/if}
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
			{#each batallas as b, i (b.cod)}
				<!-- Un corte donde se acaban las batallas vivas. Son 52 filas y la
				     diferencia entre "esto se puede dar la vuelta" y "esto ya no" es la
				     más importante de la lista: sin el corte, el lector la tiene que
				     deducir del gris de las filas. -->
				{#if !b.alcanzable && i > 0 && batallas[i - 1].alcanzable}
					<li class="corte">
						<span>Sin batalla — el hueco ya no cabe en lo que queda por escrutar</span>
					</li>
				{/if}

				<li
					id="batalla-{b.cod}"
					class="fila"
					class:fuera={!b.alcanzable}
					class:resaltada={seleccionada === b.cod}
				>
					<!-- El puesto, en su columna. Numerar solo vale si el orden dice algo,
					     y aquí lo dice: la lista ES un ranking de cuán reñido está cada
					     último escaño. Da además el ritmo vertical que le faltaba a 52
					     filas de tres líneas de texto, y empareja la lista con la tira de
					     las tres de arriba, que ya numera. -->
					<span class="fila-puesto" aria-hidden="true">
						{#if b.alcanzable}{i + 1}{/if}
					</span>

					<div class="fila-cuerpo">
						<div class="fila-cabeza">
							<span class="prov">{b.nombre}</span>
							{#if b.pctEscrutado != null}
								<span class="escrut">{b.pctEscrutado.toFixed(1)} % escrutado</span>
							{/if}
						</div>

						<!-- La fila se lee como una frase, con las dos marcas en pastillas de
						     su color y el hueco en votos dentro del texto.

						     Aquí hubo tres intentos de contarlo con geometría —una barra
						     parte-sobre-total, esa misma barra normalizada, y un filete de
						     ancho variable entre las dos pastillas— y los tres acabaron en el
						     mismo sitio: la distribución está tan sesgada (la proporción va de
						     1 a 344 por mil, un factor 300) que la cabeza de la lista, que es
						     la que importa, siempre salía aplastada e indistinguible. La única
						     forma de separarla era una escala no lineal, y entonces el largo
						     deja de poder compararse como cantidad, que es lo único que una
						     barra sabe hacer. Si vuelve a surgir la idea de una barra, el
						     problema no es de implementación. -->
						<p class="duelo">
							<span
								class="chip"
								style="background:{b.aspirante.color};color:{tintaSobre(b.aspirante.color)}"
							>{b.aspirante.siglas}</span>
							está a <span class="duelo-votos">{formatMiles(b.votosFaltantes)}</span>
							{b.votosFaltantes === 1 ? 'voto' : 'votos'} de quitarle el escaño a
							<span
								class="chip"
								style="background:{b.tiene.color};color:{tintaSobre(b.tiene.color)}"
							>{b.tiene.siglas}</span>
						</p>

						<!-- El dato de la fila es el del Ministerio, no el nuestro. La
						     proporción sigue siendo lo que ordena la lista y lo que explica la
						     nota del pie, pero en la fila lo que se lee es el censo que queda
						     por escrutar: es la cifra real contra la que hay que medir el hueco
						     de arriba. -->
						<!-- Pie de la fila: a la izquierda el dato del Ministerio, a la
						     derecha la proporción con la que ordenamos la lista. Está aquí
						     para que el orden se pueda auditar desde la propia fila — quien
						     se pregunte por qué Madrid va por encima de Teruel con un hueco
						     mucho mayor tiene la respuesta en el sitio donde surge la duda,
						     y la nota del pie de la vista explica la unidad. -->
						<div class="medida">
							<p class="medida-dato">
								{#if b.censoSinEscrutar === 0}
									Sin votos por contar: el escaño está decidido
								{:else}
									{formatMiles(b.censoSinEscrutar)} electores por escrutar en la provincia
								{/if}
							</p>
							<p class="medida-tasa">
								<span class="medida-cifra">{formatPorMil(b.esfuerzo)}</span>
								<span class="medida-unidad">de cada mil pendientes</span>
							</p>
						</div>
					</div>
				</li>
			{/each}
		</ol>

	{/if}

	<!-- La nota va fuera del `if` de datos a propósito: explica cómo se mide, y
	     eso se puede leer igual antes de que haya un solo voto contado. En prosa
	     y sin recuadro de aviso, como el resto de las notas del panel.

	     Escrita contra lo que la página hace hoy: el denominador es el CENSO que
	     queda por escrutar, no los votos que de ese censo se emitirán, que son
	     menos. De ahí que "sin batalla" se defina como "el hueco ya es mayor que
	     el censo pendiente" —literalmente cierto— y no como "no cabe en los votos
	     que quedan", que sería falso. Si ese denominador pasa a votos estimados,
	     hay que reescribir el primer párrafo.

	     Las cifras de Madrid y Teruel del ejemplo son el censo sin escrutar real
	     del snapshot al 39 % (3.170.729 y 75.640), redondeadas; el hueco de 4.000
	     y 500 es hipotético, para que la cuenta se pueda seguir a mano. -->
	<section class="metodologia">
		<h2 class="seccion seccion--pie">
			<span class="seccion-texto">Cómo se ordenan las provincias</span>
		</h2>

		<p>
			La lista no se ordena por el número de votos del hueco, sino por su proporción frente a
			lo que queda por escrutar — cuántos votos le faltan al aspirante de cada mil electores
			pendientes, que son el censo de la provincia menos la parte ya contada. Así, un hueco
			de 4.000 votos en Madrid es una batalla más apretada que uno de 500 en Teruel: 1,3
			votos de cada mil pendientes frente a 6,6. Arriba están las proporciones más pequeñas,
			que son los escaños que se deciden por menos; cuando el hueco ya es mayor que el censo
			que queda por escrutar, la provincia aparece como «sin batalla».
		</p>

		<p>
			Al principio de la noche la proporción apenas distingue: queda tanto por contar que
			cualquier diferencia cabe en lo pendiente. Por debajo del {ESCRUTINIO_BATALLA_FIABLE} %
			escrutado esta página no cuenta escaños en disputa — enseña la más ajustada, lo contado
			y un aviso de que las cifras se van a mover.
		</p>
	</section>
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

	.aviso {
		margin: 0;
		padding: 28px 16px;
		text-align: center;
		font-size: 12px;
		color: #9ca3af;
		background: #fff;
		border: 1px solid #e5e7eb;
	}

	/* ---- Títulos de sección ----------------------------------------------- */

	/* Flush a la izquierda, en caja baja y con el filete corriendo hasta el
	   margen: es el título de sección del periódico, y es lo que sustituye a los
	   cuatro antetítulos en versalitas centrados que había. El filete hace el
	   trabajo que hacía el centrado —marcar que empieza algo— sin el tic. */
	.seccion {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 0 12px;
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 800;
		line-height: 1.2;
		letter-spacing: -0.01em;
		color: var(--ink, #0a0e14);
	}

	.seccion-texto {
		flex: none;
	}

	/* El filete ocupa lo que sobra. `::after` y no un elemento en el marcado: no
	   es contenido. */
	.seccion::after {
		content: '';
		flex: 1;
		height: 1px;
		min-width: 12px;
		background: #e5e7eb;
	}

	/* La nota del pie es la misma sección, pero recesiva: cierra la página, no la
	   abre. */
	.seccion--pie {
		font-size: 12.5px;
		font-weight: 700;
		color: var(--grey, #6b7280);
	}

	/* ---- Portada de la vista --------------------------------------------- */

	/* Sin card, sin barra lateral y sin filete inferior. La portada de una pieza
	   no va dentro de una tarjeta ni necesita marcas de inicio o de cierre: es el
	   arranque de la página y eso ya lo dice su posición. Lo que la separa de lo
	   que viene es el aire. */
	.portada {
		margin: 0 0 20px;
	}

	/* El titular ocupa el ancho de la columna. Tenía un tope de 30ch y el propio
	   titular mide 33 caracteres, así que partía en dos antes de llegar al "en
	   directo" y dejaba la mitad derecha vacía: el tope de medida es para los
	   párrafos, no para un titular de una línea.

	   `text-wrap: balance` para que, cuando sí parta (móvil), no quede una viuda
	   de una palabra en la última línea — es lo que separa un titular compuesto de
	   uno volcado. */
	.portada-titular {
		margin: 0 0 9px;
		font-family: var(--font-display);
		font-size: 27px;
		font-weight: 800;
		line-height: 1.14;
		letter-spacing: -0.025em;
		text-wrap: balance;
		color: var(--ink, #0a0e14);
	}

	/* Antetítulo: el punto teal con latido de la casa (EscrutinioHeader) más el
	   rótulo. En el teal oscuro, que sobre papel blanco da 4,8:1 como texto. */
	.portada-directo {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 7px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--cd, #00b38a);
	}

	.portada-punto {
		width: 6px;
		height: 6px;
		background: var(--c, #01f3b3);
		border: 1px solid var(--cd, #00b38a);
		flex: none;
		animation: latido 1.8s ease-in-out infinite;
	}

	/* Mismo latido que el faldón de cabecera, copiado y no reinventado. */
	@keyframes latido {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.45;
			transform: scale(0.75);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.portada-punto {
			animation: none;
		}
	}

	.portada-dato {
		margin: 0;
		font-size: 13px;
		line-height: 1.45;
		color: var(--grey, #6b7280);
	}

	.portada-dato strong {
		font-size: 17px;
		font-weight: 800;
		color: var(--ink, #0a0e14);
		font-variant-numeric: tabular-nums;
	}

	/* Las tres de cabecera. Sin card, igual que el mapa: envolverlas en el
	   "chrome" de tarjeta las pondría al nivel de la lista de 52, y son la
	   entrada a esa lista. */
	.renidas {
		margin-bottom: 16px;
		min-width: 0;
	}

	.renidas-lista {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* Botón y no un div con `onclick`: lleva a la fila de la lista, así que es
	   navegación y tiene que funcionar con teclado. Se le quita el aspecto de
	   botón pero no el comportamiento. */
	.renida {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 9px 12px;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-bottom: none;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		min-width: 0;
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
	}

	.renidas-lista li:last-child .renida {
		border-bottom: 1px solid #e5e7eb;
	}

	/* La sombra de sello del workspace: dice "esto es clicable" sin inventar una
	   sombra difuminada nueva. */
	.renida:hover,
	.renida:focus-visible {
		outline: none;
		transform: translate(-2px, -2px);
		box-shadow: var(--shadow-hard, 2px 2px 0 rgba(10, 14, 20, 0.15));
	}

	.renida-puesto {
		flex: none;
		width: 20px;
		font-size: 17px;
		font-weight: 800;
		line-height: 1;
		color: #d4d4d0;
		font-variant-numeric: tabular-nums;
	}

	.renida-cuerpo {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.renida-prov {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink, #0a0e14);
	}

	.renida-duelo {
		font-size: 11.5px;
		line-height: 1.7;
		color: var(--grey, #6b7280);
		min-width: 0;
	}

	/* La pastilla de la tira es la misma, un punto más pequeña: aquí acompaña a
	   texto de 11,5 px y no de 13 px. */
	.chip--mini {
		padding: 2px 6px 3px;
		font-size: 11px;
	}

	.renida-hueco {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		flex: none;
		margin-left: auto;
		padding-left: 10px;
		text-align: right;
	}

	.renida-cifra {
		font-size: 16px;
		font-weight: 800;
		line-height: 1.05;
		color: var(--ink, #0a0e14);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.renida-label {
		font-size: 9px;
		letter-spacing: 0.02em;
		color: #9ca3af;
		white-space: nowrap;
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

	/* Mientras el escrutinio es bajo, el ranking es cierto pero volátil. Decirlo
	   aquí y no en una nota al pie: es lo que evita que "133 votos en Murcia" se
	   lea como que esa provincia es un pañuelo, cuando lo que pasa es que queda
	   el 61 % por contar.

	   Sin caja ni barra de color: la llamada de atención en recuadro con filete
	   lateral es un tic muy reconocible de interfaz generada, y aquí basta la
	   prosa. */
	/* Alineado a la caja del texto, no centrado. Era el último centrado que
	   quedaba por encima del mapa, y la prosa centrada en cursiva es medio tic en
	   sí misma. Sigue sin caja ni filete de color: eso es norma del workspace. */
	/* Al ancho de la columna, como las cajas de la tira que tiene encima: a 12 px
	   un tope de 78ch se queda en unos 470 px de los 760 de la columna, y la línea
	   acababa antes que las cajas de arriba. */
	.aviso-escrutinio {
		margin: 0 0 18px;
		font-size: 12px;
		font-style: italic;
		line-height: 1.5;
		color: #6b7280;
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

	/* Dos columnas: el puesto en su canal y el contenido. Numerar solo vale si el
	   orden dice algo, y aquí la lista ES un ranking de cuán reñido está cada
	   último escaño. Da además el ritmo vertical que le faltaba a 52 filas de
	   tres líneas de texto, y empareja la lista con la tira de las tres de
	   arriba, que ya numera. */
	.fila {
		display: grid;
		grid-template-columns: 30px minmax(0, 1fr);
		gap: 12px;
		align-items: start;
	}

	.fila-puesto {
		font-size: 17px;
		font-weight: 800;
		line-height: 1.3;
		text-align: right;
		color: #d4d4d0;
		font-variant-numeric: tabular-nums;
	}

	.fila-cuerpo {
		min-width: 0;
	}

	/* El corte entre las batallas vivas y las que ya no lo están. Son 52 filas y
	   esa es la distinción más importante de la lista: sin el corte hay que
	   deducirla del gris del fondo. Rótulo sobre el papel de la página, sin card:
	   es un separador, no una fila más. */
	.corte {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 18px 0 9px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.corte::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #e5e7eb;
	}

	/* El corte parte la lista en dos, así que la primera fila de abajo recupera su
	   borde superior: ya no es "la siguiente" de la de arriba. */
	.corte + .fila {
		border-top: 1px solid #e5e7eb;
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

	/* ---- El cara a cara --------------------------------------------------- */

	/* La frase. `line-height` generoso porque las pastillas son más altas que el
	   texto y sin aire las líneas se tocarían al envolver. */
	.duelo {
		margin: 0 0 7px;
		font-size: 13px;
		line-height: 1.75;
		color: var(--grey, #6b7280);
	}

	/* El hueco en votos, dentro de la frase: es el dato de la fila, así que tiene
	   peso, pero no se sale del texto — en el momento en que se convierte en una
	   cifra aparte, la frase deja de poder leerse de corrido. */
	.duelo-votos {
		font-size: 16px;
		font-weight: 800;
		color: var(--ink, #0a0e14);
		font-variant-numeric: tabular-nums;
	}

	/* La pastilla lleva el color EXACTO del catálogo —es donde la identidad tiene
	   que ser fiel— y la sigla encima con la tinta que decide `tintaSobre()`. El
	   filete neutro de 1px es el de la norma del workspace: los colores más
	   claros (EH Bildu, ERC) se pierden contra el papel sin él, y no toca el
	   color del partido. */
	.chip {
		display: inline-block;
		/* Centrada con la línea de texto que la rodea, no apoyada en su base. */
		vertical-align: middle;
		position: relative;
		top: -1px;
		max-width: 100%;
		padding: 4px 9px 5px;
		border: 1px solid rgba(10, 14, 20, 0.2);
		font-size: 12.5px;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: 0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* En las decididas el color se apaga: lo interesante está arriba. */
	.fila.fuera .chip {
		opacity: 0.45;
	}

	.fila.fuera .duelo-votos {
		color: #6b7280;
		font-weight: 700;
	}

	/* La proporción que ordena la lista, en prosa y recesiva: es el criterio, no
	   el titular de la fila. */
	.medida {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 14px;
		min-width: 0;
	}

	.medida-dato {
		margin: 0;
		font-size: 10.5px;
		line-height: 1.4;
		color: #9ca3af;
		min-width: 0;
	}

	/* La tasa, a la derecha y abajo. Recesiva a propósito: justifica el orden, no
	   compite con el hueco en votos de la frase de arriba. */
	.medida-tasa {
		margin: 0;
		flex: none;
		text-align: right;
		line-height: 1.15;
	}

	.medida-cifra {
		font-size: 12.5px;
		font-weight: 800;
		color: #6b7280;
		font-variant-numeric: tabular-nums;
	}

	.medida-unidad {
		display: block;
		font-size: 8.5px;
		letter-spacing: 0.02em;
		color: #c4c4c0;
		white-space: nowrap;
	}

	/* La nota cierra la vista y es texto para leer, no una ficha de datos: medida
	   de línea corta y color recesivo, pero cuerpo suficiente para que se lea de
	   verdad. Sin caja ni filete lateral. */
	/* Sin filete superior: el propio título de sección ya lleva el suyo corriendo
	   hasta el margen, y el separador horizontal encima era una raya de más. La
	   separación la hace el aire. Alineada a la izquierda y no centrada en la
	   columna: el resto de la vista arranca en el mismo margen. */
	.metodologia {
		max-width: 78ch;
		margin: 30px 0 0;
	}

	.metodologia p {
		margin: 0 0 9px;
		font-size: 12px;
		line-height: 1.55;
		color: #6b7280;
	}

	.metodologia p:last-child {
		margin-bottom: 0;
	}




	@media (max-width: 640px) {
		.main {
			padding: 14px 14px 24px;
		}

		.portada {
			margin-bottom: 16px;
		}

		/* A 375 px un titular de 27 px parte en seis líneas: baja a 21 y la medida
		   de línea deja de tener tope, que a ese ancho lo pone la pantalla. */
		.portada-titular {
			max-width: none;
			font-size: 21px;
			letter-spacing: -0.02em;
		}

		.portada-dato {
			font-size: 12px;
		}

		/* El canal del puesto se estrecha: a 375 px esos 30 px son ancho de texto. */
		.fila {
			grid-template-columns: 19px minmax(0, 1fr);
			gap: 9px;
		}

		.fila-puesto {
			font-size: 14px;
		}

		.renida {
			gap: 9px;
			padding: 8px 10px;
		}

		.renida-puesto {
			width: 15px;
			font-size: 14px;
		}

		.renida-hueco {
			padding-left: 8px;
		}

		.renida-cifra {
			font-size: 14px;
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

		/* El cara a cara se queda en tres columnas —es la pieza de la vista y
		   apilado deja de ser un cara a cara—, pero con siglas largas
		   ("SENADO DE PROGRESO") no cabe, así que la pastilla envuelve en dos
		   líneas en vez de recortarse con puntos suspensivos. */
		.duelo {
			gap: 6px;
		}

		.chip {
			padding: 3px 7px 4px;
			font-size: 11px;
			white-space: normal;
			text-overflow: clip;
		}

		/* La frase envuelve sola: a 375 px no hay nada que reordenar, que es la
		   ventaja de haber quitado la rejilla. Solo baja el cuerpo. */
		.duelo {
			font-size: 12px;
			line-height: 1.8;
		}

		.duelo-votos {
			font-size: 15px;
		}

		.chip {
			padding: 3px 7px 4px;
			font-size: 11px;
			white-space: normal;
			text-overflow: clip;
		}

		.medida-dato {
			font-size: 9.5px;
		}

		.medida-cifra {
			font-size: 11.5px;
		}

		.metodologia p {
			font-size: 11.5px;
		}
	}
</style>
