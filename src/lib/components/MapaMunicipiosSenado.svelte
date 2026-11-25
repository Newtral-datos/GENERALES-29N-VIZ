<script lang="ts">
	import { computeBounds, fitBox, featurePaths, type GeoFeature, type FeatureCollection } from '#lib/geo';
	import { assetDinamico, getMunicipiosSenado, type ResultadoMunicipioSenado } from '#lib/data';
	import { fillDe, etiquetaDe, GRIS_SIN_DATOS } from '#lib/empates';
	import PatronesEmpate from '#lib/components/PatronesEmpate.svelte';

	type MuniProps = { NATCODE: string; NAMEUNIT: string; cod_prov: string };
	type Feature = GeoFeature<MuniProps>;

	let { cod }: { cod: string } = $props();

	let features = $state<Feature[] | null>(null);
	let datos = $state<Record<string, ResultadoMunicipioSenado> | null>(null);

	$effect(() => {
		const codActual = cod;
		features = null;
		datos = null;
		// La geometría municipal se carga por provincia: el fichero nacional son
		// ~130 MB en crudo y 4 MB simplificado repartido en 52, así que traerlas
		// todas para enseñar una sería absurdo.
		fetch(assetDinamico(`data/municipios/${codActual}.geojson`), { cache: 'no-cache' })
			.then((res) => res.json())
			.then((d: FeatureCollection<MuniProps>) => {
				features = d.features;
			})
			.catch(() => {
				features = [];
			});
		getMunicipiosSenado(codActual)
			.then((d) => {
				datos = d;
			})
			.catch(() => {
				datos = {};
			});
	});

	function ine(natcode: string): string {
		// El NATCODE del geojson es el código GISCO; los 5 últimos dígitos son el
		// INE de provincia + municipio, que es la clave de los resultados.
		return natcode.slice(-5);
	}

	// Gris sin escrutar y color del más votado en todo lo demás, empate incluido
	// (ver RAYADO_EMPATES en #lib/empates). El estado lo marca el pipeline, igual
	// que en los mapas del Congreso.
	// Mismo criterio que MapaMunicipios: sin un solo resultado, la provincia
	// entera al gris de "sin escrutar". `fillDe(undefined)` da papel, y eso es
	// para el otro caso —un municipio que falta habiendo datos de los demás—, no
	// para una provincia sin escrutar: en blanco el mapa parece roto.
	let sinResultados = $derived(!datos || Object.keys(datos).length === 0);

	function colorFor(natcode: string): string {
		if (sinResultados) return GRIS_SIN_DATOS;
		return fillDe(datos?.[ine(natcode)]?.ganador);
	}

	let ganadores = $derived(Object.values(datos ?? {}).map((m) => m.ganador));

	const W = 420;
	const H = 320;

	let bounds = $derived(features && features.length ? computeBounds(features) : null);
	let vp = $derived(bounds ? fitBox(bounds, W, H) : { w: W, h: H });

	// Popup al pasar el ratón: el <title> nativo no se puede maquetar y es
	// invisible en móvil (AGENTS.md, "Mapas coropléticos").
	let activo = $state<ResultadoMunicipioSenado | null>(null);
	let popupPos = $state({ x: 0, y: 0 });
	const POPUP_W = 180;
	const POPUP_H = 128;

	function colocar(x: number, y: number) {
		// Voltea al lado contrario del cursor cuando no cabe, en vez de recortar
		// contra el borde.
		const cabeDerecha = window.innerWidth - x >= POPUP_W + 20;
		const left = cabeDerecha ? x + 12 : x - POPUP_W - 12;
		const cabeAbajo = window.innerHeight - y >= POPUP_H + 20;
		popupPos = {
			x: Math.min(Math.max(left, 8), window.innerWidth - POPUP_W - 8),
			y: cabeAbajo ? y + 12 : y - POPUP_H - 12
		};
	}

	function onEnter(e: MouseEvent, f: Feature) {
		activo = datos?.[ine(f.properties.NATCODE)] ?? null;
		if (activo) colocar(e.clientX, e.clientY);
	}

	function onMove(e: MouseEvent) {
		colocar(e.clientX, e.clientY);
	}

	function onLeave() {
		activo = null;
	}

</script>

<section class="panel">
	<p class="kicker">Senado por municipio</p>

	<div class="panel-body">
		{#if !features || !datos}
			<p class="loading">Cargando mapa…</p>
		{:else if features.length === 0}
			<p class="loading">No hay geometría de esta provincia</p>
		{:else}
			<div class="wrap">
				<svg viewBox="0 0 {vp.w} {vp.h}" class="mapa">
					<defs>
						<PatronesEmpate {ganadores} />
					</defs>
					{#each features as f (f.properties.NATCODE)}
						{#each featurePaths(f, bounds!, vp.w, vp.h) as d, i (i)}
							<path
								{d}
								fill={colorFor(f.properties.NATCODE)}
								stroke="#d8d8d8"
								stroke-width="0.4"
								class="muni"
								role="img"
								aria-label={f.properties.NAMEUNIT}
								onmouseenter={(e) => onEnter(e, f)}
								onmousemove={onMove}
								onmouseleave={onLeave}
							/>
						{/each}
					{/each}
				</svg>

				{#if activo}
					<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
						<span class="popup-nombre">
							{activo.nombre}{#if etiquetaDe(activo.ganador)}<span class="popup-estado"> — {etiquetaDe(activo.ganador)}</span>{/if}
						</span>
						{#each activo.principales.slice(0, 3) as p (p.siglas)}
							<span class="popup-fila">
								<span class="popup-swatch" style="background:{p.color}"></span>
								<span class="popup-siglas">{p.siglas}</span>
								<span class="popup-pct">
									{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%
								</span>
							</span>
						{/each}
					</div>
				{/if}
			</div>

			<p class="nota">
				Partido más votado al Senado en cada municipio — gris = sin escrutar; en un
				empate se pinta el color del más votado. Son votos a candidatos, no
				papeletas: con voto limitado cada votante marca hasta tres
			</p>
		{/if}
	</div>
</section>

<style>
	.panel {
		background: #fff;
		border: 1px solid #e5e7eb;
		min-width: 0;
	}

	.kicker {
		margin: 0;
		padding: 7px 0;
		background: #fafafa;
		border-bottom: 1px solid #f0f0f0;
		border-left: 3px solid var(--c, #01f3b3);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #9ca3af;
		text-align: center;
	}

	.panel-body {
		padding: 20px;
		min-width: 0;
	}

	.wrap {
		position: relative;
	}

	.mapa {
		display: block;
		width: 100%;
		max-width: 420px;
		height: auto;
		margin: 0 auto;
	}

	.muni:hover {
		stroke: var(--ink, #0a0e14);
		stroke-width: 1;
	}

	.loading {
		margin: 0;
		padding: 28px 0;
		text-align: center;
		color: #9ca3af;
		font-size: 11px;
	}




	.nota {
		margin: 10px 0 0;
		font-size: 9.5px;
		line-height: 1.45;
		color: #9ca3af;
		text-align: center;
		font-style: italic;
	}

	.popup {
		position: fixed;
		z-index: 40;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 150px;
		padding: 8px 10px;
		background: #fff;
		border: 1px solid #e5e7eb;
		/* Sombra de sello del workspace: offset duro, sin difuminado. */
		box-shadow: var(--shadow-hard, 2px 2px 0 rgba(10, 14, 20, 0.15));
		pointer-events: none;
	}

	.popup-nombre {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink, #0a0e14);
	}

	.popup-fila {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10.5px;
	}

	.popup-swatch {
		width: 8px;
		height: 8px;
		flex: none;
		border: 1px solid #e5e7eb;
	}

	.popup-siglas {
		flex: 1;
		color: var(--ink, #0a0e14);
	}

	.popup-pct {
		font-weight: 700;
		color: var(--ink, #0a0e14);
	}

	.popup-estado {
		font-weight: 400;
		text-transform: none;
		color: #9ca3af;
	}

	@media (max-width: 640px) {
		.panel-body {
			padding: 14px;
		}
	}
</style>
