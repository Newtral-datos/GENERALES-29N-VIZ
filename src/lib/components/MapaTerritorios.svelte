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
	type Ambito = { nombre: string; ganador: Ganador };

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
		buscador = false
	}: {
		comunidades: Record<string, Ambito> | null;
		provincias: Record<string, Ambito> | null;
		popup: Snippet<[Ambito]>;
		municipios: Snippet<[string]>;
		nota: string;
		buscador?: boolean;
	} = $props();

	let nivel = $state<Nivel>('ccaa');
	let codCcaaSel = $state<string | null>(null);
	let codProvSel = $state<string | null>(null);

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

	// Gris liso si no hay nada escrutado, rayado con los colores de los
	// empatados si varios comparten el máximo, color del partido si gana uno
	// solo. Ver #lib/empates: el estado lo marca el pipeline, aquí no se
	// recalcula nada.
	// Sin un solo ámbito en los datos —el panel desplegado antes de que el
	// pipeline haya publicado nada, o una petición que falla— el mapa se pinta
	// entero en el gris de "sin escrutar" en vez de en blanco: a las 20:00 del
	// 29N eso es exactamente lo que pasa, y un mapa en blanco parece roto.
	// `fillDe(undefined)` sigue dando papel para el otro caso, que no es el
	// mismo: una región que no aparece entre datos que sí existen.
	let sinAmbitos = $derived(!ambitos || Object.keys(ambitos).length === 0);

	function colorFor(cod: string): string {
		if (sinAmbitos) return GRIS_SIN_DATOS;
		return fillDe(ambitos?.[cod]?.ganador);
	}

	let ganadores = $derived(Object.values(ambitos ?? {}).map((p) => p.ganador));

	// Popup con las tres primeras fuerzas de la provincia bajo el cursor.
	let activeCod = $state<string | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	const POPUP_W = 190;
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

	function onProvinceClick(codProv: string) {
		goto(`${resolve('/provincias')}?cod=${codProv}`);
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
		goto(`${resolve('/provincias')}?cod=${m.codProv}&muni=${m.ine}`);
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
	}

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
		// Dentro de una comunidad: solo sus provincias.
		return (allFeatures ?? [])
			.filter((f) => f.properties.cod_ccaa === codCcaaSel)
			.map((f) => ({
				type: 'Feature' as const,
				properties: { cod: f.properties.cod_prov, nombre: f.properties.name },
				geometry: f.geometry
			}));
	});

	// El recuadro de Canarias solo tiene sentido en el mapa de España entera. Al
	// entrar en Canarias el encuadre ya es el del archipiélago, así que sus dos
	// provincias se dibujan normales y el recuadro desaparece.
	let esCanarias = $derived(nivel === 'ccaa' ? false : codCcaaSel === CANARIAS_CCAA);
	let mainFeatures = $derived(
		nivel === 'ccaa'
			? featuresNivel.filter((f) => f.properties.cod !== CANARIAS_CCAA)
			: featuresNivel
	);
	let canaryFeatures = $derived(
		nivel === 'ccaa' ? featuresNivel.filter((f) => f.properties.cod === CANARIAS_CCAA) : []
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
			<button type="button" class="miga" class:activa={nivel === 'ccaa'} onclick={() => volverA('ccaa')}>
				España
			</button>
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
			{#if nombreProv}
				<span class="sep">›</span>
				<span class="miga activa">{nombreProv}</span>
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

	.miga {
		padding: 2px 4px;
		border: 0;
		background: none;
		font: inherit;
		color: #9ca3af;
		cursor: pointer;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 700;
	}

	.miga:hover {
		color: var(--ink, #0a0e14);
	}

	.miga.activa {
		color: var(--ink, #0a0e14);
		cursor: default;
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
		width: 190px;
		background: var(--paper);
		border: 1px solid var(--ink);
		padding: 8px 10px;
		box-shadow: var(--shadow-hard);
	}










</style>
