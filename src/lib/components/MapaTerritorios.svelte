<script lang="ts">
	import { CONVOCATORIA } from '#lib/config';
	import { asset, resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { getResultados, getIndiceMunicipios, type Provincia, type MunicipioIndice } from '#lib/data';
	import type { Snippet } from 'svelte';
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection as FC } from '#lib/geo';
	import { fillDe, etiquetaDe, GRIS_SIN_DATOS, type Ganador } from '#lib/empates';
	import PatronesEmpate from '#lib/components/PatronesEmpate.svelte';
	import MapaMunicipios, { type MunicipioSeleccionado } from '#lib/components/MapaMunicipios.svelte';

	// Las dos geometrías comparten forma: un código y un nombre. El geojson de
	// provincias lleva además `cod_ccaa`, que es lo que permite filtrar las de
	// una comunidad sin cargar una tabla de correspondencias aparte (lo escribe
	// scripts/generar_geometria_ccaa.py).
	type PropsProv = { name: string; cod_prov: string; cod_ccaa: string; ccaa: string };
	type PropsCcaa = { ccaa: string; cod_ccaa: string };
	type Feature = GeoFeature<PropsProv>;
	type FeatureCcaa = GeoFeature<PropsCcaa>;
	type FeatureCollection = FC<PropsProv>;

	type Nivel = 'ccaa' | 'provincia' | 'municipio';
	// Lo único que este mapa necesita saber de un ámbito. Congreso y Senado
	// traen más campos cada uno; los pinta su propio snippet de popup.
	// `ganador` es opcional: los mapas de partido lo traen y colorean con él, y
	// el de participación no tiene ganador —colorea por escala— así que pasa su
	// propia función de color (ver el prop `color`).
	type Ambito = { nombre: string; ganador?: Ganador };

	// Las Palmas (35) y Santa Cruz de Tenerife (38) se dibujan aparte: su posición
	// geográfica real deja un hueco enorme de océano entre ellas y la Península.
	// A nivel de comunidad el archipiélago entero es el código 05.
	const CANARIAS_CODES = new Set(['35', '38']);
	const CANARIAS_CCAA = '05';

	/**
	 * El mismo motor de tres niveles para las dos cámaras.
	 *
	 * Lo que cambia entre Congreso y Senado no es la navegación —comunidad,
	 * provincia, municipio— sino qué se enseña en cada ámbito: diputados y
	 * porcentaje de voto en uno, senadores electos en el otro. Así que la
	 * navegación, el encuadre, el recuadro de Canarias y el coloreado viven
	 * aquí una sola vez, y el contenido del popup y el nivel municipal entran
	 * como `snippet`.
	 *
	 * La alternativa era un segundo mapa calcado para el Senado, que es
	 * exactamente el gemelo que se separa a la primera corrección.
	 */
	let {
		comunidades,
		provincias,
		popup,
		municipios,
		nota,
		buscador = false,
		color,
		leyenda,
		nivelInicial = 'ccaa',
		nivel = $bindable(nivelInicial),
		codProvSel = $bindable(null),
		onCambioDeNivel,
		onMunicipio
	}: {
		comunidades: Record<string, Ambito> | null;
		provincias: Record<string, Ambito> | null;
		popup: Snippet<[Ambito]>;
		municipios: Snippet<[string]>;
		nota: string;
		buscador?: boolean;
		/**
		 * Con qué color se rellena cada ámbito. Por defecto, el del partido
		 * ganador.
		 *
		 * Lo inyecta `/participacion`, que no colorea por ganador sino por una
		 * **escala secuencial** de porcentaje. Es lo único que impedía que esa
		 * vista usara este motor y tuviera que llevar su propio mapa con su
		 * recuadro de Canarias, su encuadre y sus migas duplicados.
		 */
		color?: (cod: string) => string;
		/**
		 * Leyenda bajo el mapa. Los mapas de partido no la llevan —el popup y la
		 * nota hacen ese trabajo— pero una escala secuencial no se puede leer sin
		 * ella.
		 */
		leyenda?: Snippet;
		/**
		 * Nivel en el que abre el mapa, y **suelo** del que no se puede subir.
		 *
		 * La home abre en comunidades, que es su vista por defecto. `/provincias`
		 * abre directamente en provincias: ahí el nivel de comunidad no aporta
		 * —la pregunta de esa vista es "qué pasó en mi provincia"— y una miga
		 * para "volver a España" llevaría a un nivel en el que nunca se estuvo.
		 */
		nivelInicial?: Nivel;
		/**
		 * El nivel y la provincia abierta, hacia fuera.
		 *
		 * Hacen falta porque `/provincias` pinta la tabla **al lado** del mapa, y
		 * esa tabla tiene que saber qué hay abierto. Son `$bindable` y opcionales:
		 * quien no los pase —la home y el Senado— se comporta igual que antes,
		 * porque el estado sigue viviendo aquí.
		 */
		nivel?: Nivel;
		codProvSel?: string | null;
		/**
		 * Se llama cada vez que cambia el nivel, al bajar y al subir, con la
		 * provincia abierta o `null`.
		 *
		 * Es para que `/provincias` escriba la query string (`?cod=`) **desde el
		 * manejador del clic**. No se puede hacer con un `$effect` que mire
		 * `codProvSel` y llame a `replaceState`: ese efecto depende de `page.url`
		 * y además lo modifica, así que se vuelve a disparar a sí mismo en bucle
		 * y cuelga la pestaña — pasó exactamente así en este proyecto (ver
		 * AGENTS.md, "Resultados por municipio").
		 *
		 * Cubre las dos direcciones a propósito: si solo avisara al bajar, las
		 * migas de pan devolverían el mapa al nivel de provincias dejando el
		 * `?cod=` puesto, y al recargar se volvería a entrar en la provincia que
		 * el lector acababa de cerrar.
		 */
		onCambioDeNivel?: (nivel: Nivel, codProv: string | null) => void;
		/**
		 * Qué hacer cuando el buscador encuentra un municipio.
		 *
		 * Por defecto `goto('/provincias?cod=…&muni=…')`, que es lo que hace
		 * falta desde la home. Pero **dentro de `/provincias` eso navega a sí
		 * misma**: el componente no se remonta, la lectura de la query string
		 * corre una sola vez a propósito y el buscador no hacía nada. Esa vista
		 * pasa su propio manejador y se lleva al lector al municipio sin
		 * recargar.
		 */
		onMunicipio?: (m: MunicipioIndice) => void;
	} = $props();

	let codCcaaSel = $state<string | null>(null);

	let ccaaFeatures = $state<FeatureCcaa[] | null>(null);

	let allFeatures = $state<Feature[] | null>(null);

	$effect(() => {
		fetch(asset('data/provincias.geojson'), { cache: 'no-cache' })
			.then((res) => res.json())
			.then((d: FeatureCollection) => {
				allFeatures = d.features;
			});
		// 60 KB más. Se cargan las dos de entrada en vez de al bajar de nivel:
		// el salto comunidad -> provincia tiene que ser inmediato, y esperar a
		// una petición después del clic se nota.
		fetch(asset('data/ccaa.geojson'), { cache: 'no-cache' })
			.then((res) => res.json())
			.then((d: FC<PropsCcaa>) => {
				ccaaFeatures = d.features;
			});
	});

	$effect(() => {
	});

	// Qué conjunto de ámbitos manda en el nivel actual. Los dos niveles tienen
	// la misma forma de datos (el pipeline los construye con la misma función),
	// así que el motor de dibujo, el popup y el coloreado son los mismos y solo
	// cambia de qué diccionario se leen.
	let ambitos = $derived(nivel === 'ccaa' ? comunidades : provincias);

	// Gris liso si no hay nada escrutado y color del partido en el resto —
	// también en un empate, donde es el del más votado (ver RAYADO_EMPATES en
	// #lib/empates, que devuelve el rayado si algún día se quiere). El estado lo
	// marca el pipeline, aquí no se recalcula nada.
	// Sin un solo ámbito en los datos —el panel desplegado antes de que el
	// pipeline haya publicado nada, o una petición que falla— el mapa se pinta
	// entero en el gris de "sin escrutar" en vez de en blanco: a las 20:00 del
	// 29N eso es exactamente lo que pasa, y un mapa en blanco parece roto.
	// `fillDe(undefined)` sigue dando papel para el otro caso, que no es el
	// mismo: una región que no aparece entre datos que sí existen.
	let sinAmbitos = $derived(!ambitos || Object.keys(ambitos).length === 0);

	function colorFor(cod: string): string {
		if (color) return color(cod);
		if (sinAmbitos) return GRIS_SIN_DATOS;
		return fillDe(ambitos?.[cod]?.ganador);
	}

	// Solo para los patrones de empate, que son cosa de los mapas de partido.
	let ganadores = $derived(
		Object.values(ambitos ?? {})
			.map((p) => p.ganador)
			.filter((g): g is Ganador => !!g)
	);

	// Popup con las tres primeras fuerzas de la provincia bajo el cursor.
	let activeCod = $state<string | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	// 208 y no 190 desde el 26/11: las cabeceras del popup pasaron de "Dip." y
	// "% Voto" a "Escaños" y "Voto (%)", que ocupan ~28px más entre las dos. Con
	// el ancho anterior esos píxeles los perdía la celda del nombre, que es la
	// que ya se parte en dos líneas en los topónimos largos (Santa Cruz de
	// Tenerife). El número tiene que cuadrar con el `width` del `.popup`.
	const POPUP_W = 208;
	const POPUP_H = 150;

	function setPopupPos(x: number, y: number) {
		const cabeHueco = window.innerWidth - x >= POPUP_W + 20;
		const left = cabeHueco ? x + 12 : x - POPUP_W - 12;
		popupPos = {
			x: Math.min(Math.max(left, 8), window.innerWidth - POPUP_W - 8),
			y: Math.min(Math.max(y + 12, 8), window.innerHeight - POPUP_H - 8)
		};
	}

	function onProvinceEnter(e: MouseEvent, codProv: string) {
		activeCod = codProv;
		setPopupPos(e.clientX, e.clientY);
	}

	function onProvinceMove(e: MouseEvent) {
		setPopupPos(e.clientX, e.clientY);
	}

	// Buscador de municipios: lleva directo al resultado de la provincia con el municipio preseleccionado.
	let indiceMunicipios = $state<MunicipioIndice[] | null>(null);
	let busqueda = $state('');
	let dropdownAbierto = $state(false);

	$effect(() => {
		getIndiceMunicipios().then((d) => {
			indiceMunicipios = d;
		});
	});

	function normalizar(s: string): string {
		return s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	let resultadosBusqueda = $derived.by(() => {
		const q = normalizar(busqueda.trim());
		if (!indiceMunicipios || q.length < 2) return [];
		return indiceMunicipios.filter((m) => normalizar(m.nombre).includes(q)).slice(0, 8);
	});

	function irAMunicipio(m: MunicipioIndice) {
		if (onMunicipio) onMunicipio(m);
		else goto(`${resolve('/provincias')}?cod=${m.codProv}&muni=${m.ine}`);
		busqueda = '';
		dropdownAbierto = false;
	}

	function onBuscadorBlur() {
		setTimeout(() => (dropdownAbierto = false), 150);
	}

	function onProvinceLeave() {
		activeCod = null;
	}

	let activeProvincia = $derived(activeCod && ambitos ? ambitos[activeCod] : null);

	function bajarNivel(cod: string) {
		activeCod = null;
		if (nivel === 'ccaa') {
			codCcaaSel = cod;
			nivel = 'provincia';
		} else if (nivel === 'provincia') {
			codProvSel = cod;
			nivel = 'municipio';
			// Aquí había además un `onProvinceClick()` que hacía
			// `goto('/provincias?cod=…')` y que **no lo llamaba nadie**: los
			// polígonos siempre han llamado a `bajarNivel`. Se ha quitado al
			// añadir este aviso, que es lo que esa función intentaba hacer.
			onCambioDeNivel?.('municipio', cod);
		}
	}

	function volverA(destino: Nivel) {
		activeCod = null;
		nivel = destino;
		if (destino === 'ccaa') {
			codCcaaSel = null;
			codProvSel = null;
		} else if (destino === 'provincia') {
			codProvSel = null;
		}
		onCambioDeNivel?.(destino, codProvSel);
	}

	// Con `nivelInicial = 'provincia'` el nivel de comunidad no existe para esta
	// vista: la miga de España sobra y el de provincias es el suelo.
	let hayNivelCcaa = $derived(nivelInicial === 'ccaa');

	let nombreCcaa = $derived(codCcaaSel && comunidades ? comunidades[codCcaaSel]?.nombre : null);
	let nombreProv = $derived(codProvSel && provincias ? provincias[codProvSel]?.nombre : null);

	// Municipio marcado dentro del mapa municipal. El mapa de la home enseña el
	// reparto de un vistazo; para la tabla completa del municipio está la vista
	// de /provincias, que ya sabe preseleccionarlo desde la query string.
	let muniSel = $state<MunicipioSeleccionado | null>(null);

	const SIZE = 440;
	const INSET_W = SIZE * 0.3;
	const INSET_H = SIZE * 0.18;
	const INSET_X = SIZE * 0.04;
	const INSET_GAP = SIZE * 0.035;

	/**
	 * Los polígonos del nivel actual, normalizados a `{ cod, nombre }` para que
	 * el resto del componente no tenga que saber si está pintando comunidades o
	 * provincias.
	 */
	type Dibujable = GeoFeature<{ cod: string; nombre: string }>;

	let featuresNivel = $derived.by<Dibujable[]>(() => {
		if (nivel === 'ccaa') {
			return (ccaaFeatures ?? []).map((f) => ({
				type: 'Feature' as const,
				properties: { cod: f.properties.cod_ccaa, nombre: f.properties.ccaa },
				geometry: f.geometry
			}));
		}
		// Dentro de una comunidad, solo sus provincias. **Sin comunidad
		// seleccionada, las 52**: es el caso de `/provincias`, que abre
		// directamente en este nivel sin pasar por ninguna comunidad. Antes el
		// filtro comparaba contra un `codCcaaSel` nulo y no devolvía ni un
		// polígono, así que el mapa de esa vista salía vacío — se leía como "el
		// mapa no se pinta de gris", cuando lo que pasaba es que no se pintaba
		// nada.
		return (allFeatures ?? [])
			.filter((f) => !codCcaaSel || f.properties.cod_ccaa === codCcaaSel)
			.map((f) => ({
				type: 'Feature' as const,
				properties: { cod: f.properties.cod_prov, nombre: f.properties.name },
				geometry: f.geometry
			}));
	});

	/**
	 * ¿Se está dibujando el país entero? Dos casos: el mapa de comunidades, y el
	 * de las 52 provincias de `/provincias`.
	 *
	 * Es lo que decide si hace falta el recuadro de Canarias. Al entrar en una
	 * comunidad el encuadre ya es el de esa comunidad, así que si es Canarias sus
	 * dos provincias se dibujan normales y el recuadro desaparece.
	 */
	let vistaNacional = $derived(nivel === 'ccaa' || (nivel === 'provincia' && !codCcaaSel));

	// Qué código identifica al archipiélago cambia con el nivel: una comunidad
	// (05) o dos provincias (35 y 38).
	function esDeCanarias(cod: string): boolean {
		return nivel === 'ccaa' ? cod === CANARIAS_CCAA : CANARIAS_CODES.has(cod);
	}

	let mainFeatures = $derived(
		vistaNacional ? featuresNivel.filter((f) => !esDeCanarias(f.properties.cod)) : featuresNivel
	);
	let canaryFeatures = $derived(
		vistaNacional ? featuresNivel.filter((f) => esDeCanarias(f.properties.cod)) : []
	);

	let mainBounds = $derived(computeBounds(mainFeatures));
	let mainVp = $derived(mainBounds ? fitBox(mainBounds, SIZE, SIZE) : { w: SIZE, h: SIZE });

	let canaryBounds = $derived(computeBounds(canaryFeatures));
	let canaryFit = $derived(canaryBounds ? fitBox(canaryBounds, INSET_W, INSET_H) : { w: 0, h: 0 });
	// La franja de Canarias va pegada debajo del mapa peninsular, nunca encajada
	// dentro de su contorno: España no deja hueco interior lo bastante grande.
	let insetY = $derived(mainVp.h + INSET_GAP);
	let totalH = $derived(mainVp.h + INSET_GAP + INSET_H);
	let canaryOffset = $derived({
		x: INSET_X + (INSET_W - canaryFit.w) / 2,
		y: insetY + (INSET_H - canaryFit.h) / 2
	});
</script>

<div class="panel">
	<p class="kicker">Resultados por territorio</p>

	<div class="panel-body">
		<!-- Migas de pan: el único modo de saber dónde estás y de volver. Sin
		     esto, bajar dos niveles es un callejón sin salida. -->
		<nav class="migas" aria-label="Nivel del mapa">
			{#if hayNivelCcaa}
				<button type="button" class="miga" class:activa={nivel === 'ccaa'} onclick={() => volverA('ccaa')}>
					España
				</button>
			{:else}
				<button
					type="button"
					class="miga"
					class:activa={nivel === 'provincia'}
					onclick={() => volverA('provincia')}
				>
					Provincias
				</button>
			{/if}
			{#if nombreCcaa}
				<span class="sep">›</span>
				<button
					type="button"
					class="miga"
					class:activa={nivel === 'provincia'}
					onclick={() => volverA('provincia')}
				>
					{nombreCcaa}
				</button>
			{/if}
			<!-- La provincia deja de ser el final del camino cuando se baja a sus
			     municipios: ahí el nivel que se está viendo son los municipios, y
			     la provincia pasa a ser el escalón por el que se ha llegado. Antes
			     la última miga era la provincia marcada como actual, así que el
			     mapa municipal no aparecía en las migas y no había nada que
			     dijera dónde pulsar para subir. -->
			{#if nombreProv}
				<span class="sep">›</span>
				<button type="button" class="miga" onclick={() => volverA('provincia')}>
					{nombreProv}
				</button>
				<span class="sep">›</span>
				<span class="miga activa">Municipios</span>
			{/if}
		</nav>

		{#if nivel === 'municipio' && codProvSel}
			{@render municipios(codProvSel)}
		{:else if !allFeatures || !ccaaFeatures || !ambitos}
			<p class="loading">Cargando mapa…</p>
		{:else}
			<div class="wrap">
				<svg viewBox="0 0 {mainVp.w} {totalH}" class="mapa">
					<defs>
						<PatronesEmpate {ganadores} />
					</defs>
					{#each mainFeatures as f (f.properties.cod)}
						{#each featurePaths(f, mainBounds!, mainVp.w, mainVp.h) as d, i (i)}
							<path
								{d}
								fill={colorFor(f.properties.cod)}
								stroke="#d8d8d8"
								stroke-width="0.6"
								class="prov"
								role="img"
								aria-label={f.properties.nombre}
								onmouseenter={(e) => onProvinceEnter(e, f.properties.cod)}
								onmousemove={onProvinceMove}
								onmouseleave={onProvinceLeave}
								onclick={() => bajarNivel(f.properties.cod)}
							/>
						{/each}
					{/each}

					{#if canaryBounds && nivel === 'ccaa'}
						<rect
							x={INSET_X}
							y={insetY}
							width={INSET_W}
							height={INSET_H}
							fill="none"
							stroke="var(--border)"
							stroke-width="0.6"
							stroke-dasharray="2,2"
						/>
						<text x={INSET_X + 3} y={insetY + 10} class="inset-label">Canarias</text>
						{#each canaryFeatures as f (f.properties.cod)}
							{#each featurePaths(f, canaryBounds, canaryFit.w, canaryFit.h, canaryOffset.x, canaryOffset.y) as d, i (i)}
								<path
									{d}
									fill={colorFor(f.properties.cod)}
									stroke="#d8d8d8"
									stroke-width="0.6"
									class="prov"
									role="img"
									aria-label={f.properties.nombre}
									onmouseenter={(e) => onProvinceEnter(e, f.properties.cod)}
									onmousemove={onProvinceMove}
									onmouseleave={onProvinceLeave}
									onclick={() => bajarNivel(f.properties.cod)}
								/>
							{/each}
						{/each}
					{/if}
				</svg>
				<!-- La leyenda va entre el mapa y la nota: explica lo que se acaba de
				     ver, antes de las cautelas. -->
				{#if leyenda}{@render leyenda()}{/if}
				<p class="nota">{nota}</p>
			</div>
		{/if}
	</div>

	{#if buscador}
		<div class="buscador">
			<input
				type="text"
				class="buscador-input"
				placeholder="Buscar municipio…"
				bind:value={busqueda}
				onfocus={() => (dropdownAbierto = true)}
				onblur={onBuscadorBlur}
			/>
			{#if dropdownAbierto && resultadosBusqueda.length}
				<ul class="buscador-resultados">
					{#each resultadosBusqueda as m (m.codProv + m.ine)}
						<li>
							<button type="button" class="buscador-opcion" onclick={() => irAMunicipio(m)}>
								{m.nombre} <span class="buscador-provincia">({m.provincia})</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if dropdownAbierto && normalizar(busqueda.trim()).length >= 2}
				<ul class="buscador-resultados">
					<li class="buscador-sin-resultados">Sin coincidencias</li>
				</ul>
			{/if}
	</div>
	{/if}
</div>

{#if activeProvincia}
	<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
		{@render popup(activeProvincia)}
	</div>
{/if}

<style>
	.panel {
		height: 100%;
		display: flex;
		flex-direction: column;
	}





	.migas {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 10px;
		font-size: 10px;
	}

	/* **La miga pulsable tiene que parecerlo en reposo, no solo al pasar el
	   ratón** (27/11). Antes la única diferencia entre "aquí estás" y "pulsa
	   para volver" era un cambio de color al hacer hover: en móvil, que es
	   donde se ve esto la noche electoral, no existe, así que las migas
	   parecían un rótulo y nadie sabía que se podía subir. Ahora el subrayado
	   punteado las marca desde el primer momento.

	   Punteado y no continuo a propósito: continuo las convierte en enlaces de
	   cuerpo de texto y compiten con el rótulo del mapa que va justo debajo.
	   Al pasar el ratón pasa a continuo y la tinta se oscurece, que es el
	   refuerzo. */
	.miga {
		padding: 3px 5px;
		border: 0;
		background: none;
		font: inherit;
		color: #9ca3af;
		cursor: pointer;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 700;
		border-bottom: 1px dotted rgba(10, 14, 20, 0.3);
		transition:
			color 0.12s ease,
			border-color 0.12s ease,
			background 0.12s ease;
	}

	.miga:hover {
		color: var(--ink, #0a0e14);
		border-bottom-color: var(--ink, #0a0e14);
		border-bottom-style: solid;
		background: rgba(10, 14, 20, 0.04);
	}

	/* Teclado: el mismo resaltado que el ratón más el anillo del navegador, que
	   no se quita. */
	.miga:focus-visible {
		color: var(--ink, #0a0e14);
		border-bottom-color: var(--ink, #0a0e14);
		border-bottom-style: solid;
	}

	/* Dónde estás: tinta plena y sin subrayado, que es lo que la distingue de
	   las que llevan a algún sitio. No es un botón. */
	.miga.activa {
		color: var(--ink, #0a0e14);
		cursor: default;
		border-bottom: 0;
		background: none;
	}

	.sep {
		color: #d1d5db;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.kicker {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 8px 0;
		text-align: center;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
	}

	.buscador {
		position: relative;
		margin: 12px 0 0 0;
	}

	.buscador-input {
		width: 100%;
		box-sizing: border-box;
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--ink);
		background: var(--paper);
		border: 1px solid var(--border);
		padding: 8px 10px;
	}

	.buscador-input:focus {
		outline: none;
		border-color: var(--ink);
	}

	.buscador-resultados {
		position: absolute;
		z-index: 50;
		top: calc(100% + 2px);
		left: 0;
		right: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--paper);
		border: 1px solid var(--ink);
		box-shadow: var(--shadow-hard);
		max-height: 220px;
		overflow-y: auto;
	}

	.buscador-opcion {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 7px 10px;
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--ink);
		cursor: pointer;
	}

	.buscador-opcion:hover {
		background: #fafafa;
	}

	.buscador-provincia {
		color: var(--grey);
	}

	.buscador-sin-resultados {
		padding: 8px 10px;
		font-family: var(--font-body);
		font-size: 11px;
		font-style: italic;
		color: var(--grey);
	}

	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.mapa {
		width: 100%;
		max-width: 400px;
	}

	.prov {
		cursor: pointer;
	}

	.prov:hover {
		filter: brightness(0.92);
	}

	.inset-label {
		font-family: var(--font-body);
		font-size: 6px;
		font-style: italic;
		fill: var(--grey);
	}

	.nota {
		font-size: 9px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 6px 0 0 0;
		text-align: center;
	}

	.popup {
		position: fixed;
		z-index: 60;
		/* Cuadra con POPUP_W, que es lo que usa el cálculo de posición. */
		width: 208px;
		background: var(--paper);
		border: 1px solid var(--ink);
		padding: 8px 10px;
		box-shadow: var(--shadow-hard);
	}










</style>
