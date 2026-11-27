<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { getResultadosSenado, type ProvinciaSenado, type MunicipioIndice } from '#lib/data';
	import MapaTerritorios from '#lib/components/MapaTerritorios.svelte';
	import MapaMunicipiosSenado from '#lib/components/MapaMunicipiosSenado.svelte';
	import SelectorProvincia from '#lib/components/SelectorProvincia.svelte';
	import { CONVOCATORIA } from '#lib/config';
	import { etiquetaDe } from '#lib/empates';

	let provincias = $state<Record<string, ProvinciaSenado> | null>(null);

	// Sin provincia elegida de salida: la geometría municipal se sirve por
	// provincia y hay que elegir una, pero arrancar siempre en la misma la
	// convierte en un caso por defecto que no lo es.
	let cod = $state('');

	// Estado del mapa, compartido con él por `bind:`, igual que en la vista de
	// provincias del Congreso. `nivelInicial="provincia"` porque aquí el nivel de
	// comunidad no aporta: la pregunta de esta vista es "qué pasó en mi
	// provincia", y una miga para "volver a España" llevaría a un nivel en el que
	// nunca se estuvo.
	let nivel = $state<'ccaa' | 'provincia' | 'municipio'>('provincia');
	let codProvSel = $state<string | null>(null);

	$effect(() => {
		getResultadosSenado().then((d) => {
			provincias = d.provincias;
		});
	});

	// Enlace de entrada: `?cod=` lo escribe el buscador del mapa del Senado en la
	// home. Se lee **una sola vez**; después manda el mapa.
	let inicializadoDesdeUrl = false;
	$effect(() => {
		if (inicializadoDesdeUrl || !provincias) return;
		inicializadoDesdeUrl = true;
		const codUrl = page.url.searchParams.get('cod');
		if (codUrl && provincias[codUrl]) {
			codProvSel = codUrl;
			cod = codUrl;
			nivel = 'municipio';
		}
	});

	/**
	 * El selector por nombre y el mapa mueven la misma provincia.
	 *
	 * Hacen falta los dos: el mapa se pulsa y el buscador encuentra municipios,
	 * pero ninguno de los dos permite ir a una provincia **por su nombre**, que
	 * con 52 es la forma más rápida (en el Congreso ese papel lo hace la tabla de
	 * 52 filas, que aquí no existe).
	 *
	 * `ultimoCod` no es reactivo a propósito: es la memoria de qué valor ya se
	 * reconcilió, y es lo que decide quién ha movido la provincia en este tick.
	 * Sin él, los dos lados se escribirían mutuamente en bucle.
	 *
	 * **Y la URL no se toca desde aquí.** Escribirla dentro de un efecto que lee
	 * `page.url` es el bucle que ya colgó una pestaña en este proyecto (ver
	 * AGENTS.md); la URL la mantiene `alCambiarDeNivel`, que es un manejador de
	 * clic. Elegir por el selector no deja la provincia en la URL, y es un
	 * compromiso consciente: compartir el enlace sigue funcionando desde el mapa.
	 */
	let ultimoCod = '';
	$effect(() => {
		if (cod !== ultimoCod) {
			ultimoCod = cod;
			if (cod && cod !== codProvSel) {
				codProvSel = cod;
				nivel = 'municipio';
			}
		} else if ((codProvSel ?? '') !== cod) {
			cod = codProvSel ?? '';
			ultimoCod = cod;
		}
	});

	/**
	 * La URL se escribe desde el manejador del clic, nunca desde un `$effect`.
	 * Mismo criterio y mismo porqué que en `SelectorProvincias` del Congreso.
	 */
	function alCambiarDeNivel(_nivel: string, codNuevo: string | null) {
		const params = new URLSearchParams(page.url.searchParams.toString());
		// Al cambiar de ámbito el municipio marcado deja de tener sentido: es de
		// la provincia que se acaba de cerrar.
		params.delete('muni');
		if (codNuevo) params.set('cod', codNuevo);
		else params.delete('cod');
		const qs = params.toString();
		replaceState(qs ? `${page.url.pathname}?${qs}` : page.url.pathname, page.state);
	}

	/** El buscador encontró un municipio y ya estamos en esta vista. */
	function alBuscarMunicipio(m: MunicipioIndice) {
		const params = new URLSearchParams(page.url.searchParams.toString());
		params.set('cod', m.codProv);
		params.set('muni', m.ine);
		replaceState(`${page.url.pathname}?${params.toString()}`, page.state);
		codProvSel = m.codProv;
		nivel = 'municipio';
	}

	let activa = $derived(provincias?.[cod] ?? null);
</script>

<main class="main">
	<div class="volver-fila">
		<a href={resolve('/senado')} class="volver">← Volver al Senado</a>
	</div>

	<div class="intro">
		<p class="kicker">Senado por provincia y municipio</p>
		<h1 class="titulo">Cómo ha votado tu provincia al Senado</h1>
		<p class="entradilla">
			En el Senado se vota a personas, no a listas: cada votante marca hasta tres
			candidatos y salen los más votados de la circunscripción, sean del partido que
			sean. Por eso aquí no hay escaños por municipio — solo qué partido ha sido el
			más votado en cada uno.
		</p>
	</div>

	<SelectorProvincia {provincias} bind:cod />

	<!-- El mapa de provincias, con el mismo motor, el mismo buscador y las mismas
	     migas que el del Congreso en `/provincias`. Antes esta vista solo tenía el
	     desplegable y el mapa municipal: para ver el Senado de una provincia había
	     que saber su nombre, y no había forma de llegar por geografía. El mapa
	     municipal no desaparece — entra dentro, como nivel de abajo, que es como
	     funciona el del Congreso. -->
	<div class="mapa-prov">
		<MapaTerritorios
			comunidades={null}
			{provincias}
			nivelInicial="provincia"
			bind:nivel
			bind:codProvSel
			buscador
			onCambioDeNivel={alCambiarDeNivel}
			onMunicipio={alBuscarMunicipio}
			nota={`Senadores de elección directa por provincia — ${CONVOCATORIA} — busca tu municipio o pulsa una provincia para ver los suyos. Gris = sin escrutar; en un empate a escaños se pinta el color del más votado`}
		>
			{#snippet popup(a)}
				<div class="popup-senado">
					<span class="popup-nombre">
						{a.nombre}
						{#if etiquetaDe(a.ganador)}
							<span class="popup-estado"> — {etiquetaDe(a.ganador)}</span>
						{/if}
					</span>
					{#if (a as ProvinciaSenado).composicion.length === 0}
						<span class="popup-vacio">Sin senadores electos todavía</span>
					{:else}
						{#each (a as ProvinciaSenado).composicion.slice(0, 4) as p (p.siglas)}
							<span class="popup-fila">
								<span class="popup-swatch" style="background:{p.color}"></span>
								<span class="popup-siglas">{p.siglas}</span>
								<span class="popup-escanos">{p.escanos}</span>
							</span>
						{/each}
					{/if}
				</div>
			{/snippet}

			{#snippet municipios(codProv)}
				<MapaMunicipiosSenado cod={codProv} />
			{/snippet}
		</MapaTerritorios>
	</div>

	{#if activa}
		<section class="panel">
			<p class="panel-kicker">Senadores electos en {activa.nombre}</p>
			<div class="panel-body">
				{#if activa.composicion.length === 0}
					<p class="vacio">Sin senadores electos todavía</p>
				{:else}
					<ul class="composicion">
						{#each activa.composicion as p (p.siglas)}
							<li>
								<span class="swatch" style="background:{p.color}"></span>
								<span class="siglas">{p.siglas}</span>
								<span class="escanos">{p.escanos}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/if}

</main>

<style>
	.main {
		padding: 20px 24px 32px;
		max-width: 900px;
		margin: 0 auto;
		min-width: 0;
	}

	.volver-fila {
		margin-bottom: 14px;
	}

	.volver {
		font-size: 11px;
		font-weight: 700;
		color: var(--ink, #0a0e14);
		text-decoration: none;
	}

	.volver:hover {
		text-decoration: underline;
	}

	.intro {
		text-align: center;
		margin-bottom: 18px;
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

	.entradilla {
		margin: 0 auto;
		max-width: 620px;
		font-size: 12px;
		line-height: 1.5;
		color: #6b7280;
	}




	.mapa-prov {
		margin-bottom: 16px;
		min-width: 0;
	}

	/* Estilos del popup del mapa: viven aquí porque aquí está el snippet que los
	   usa — Svelte aísla el CSS por componente, así que los de SenadoView no
	   alcanzan. Son los mismos valores, a propósito: es el mismo popup en las dos
	   vistas y tiene que verse igual. */
	.popup-senado {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 170px;
	}

	.popup-nombre {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink, #0a0e14);
	}

	.popup-estado {
		font-weight: 400;
		text-transform: none;
		color: #9ca3af;
	}

	.popup-vacio {
		font-size: 10.5px;
		font-style: italic;
		color: #9ca3af;
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

	.popup-escanos {
		font-weight: 700;
		color: var(--ink, #0a0e14);
	}

	.panel {
		background: #fff;
		border: 1px solid #e5e7eb;
		margin-bottom: 16px;
		min-width: 0;
	}

	/* El rótulo del mapa, con el kicker de la casa (27/11): el mismo que llevan
	   el hemiciclo, el ranking y las tablas. Antes era una franja gris a todo
	   lo ancho con un filete teal en el canto izquierdo, y desentonaba por dos
	   motivos: el teal es el color de "esto está pasando ahora" —el punto de
	   "en directo", la barra de escrutinio—, no un adorno de encabezado, y la
	   franja metía una caja dentro de otra caja justo debajo de las migas de
	   pan. Sin fondo ni filetes, el rótulo se lee como lo que es: el título de
	   lo que hay debajo. */
	.panel-kicker {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0;
		padding: 14px 20px 0;
		text-align: center;
	}

	.panel-body {
		padding: 14px 20px;
	}

	.vacio {
		margin: 0;
		padding: 10px 0;
		text-align: center;
		font-style: italic;
		color: #9ca3af;
		font-size: 11px;
	}

	.composicion {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.composicion li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}

	.swatch {
		width: 10px;
		height: 10px;
		border: 1px solid #e5e7eb;
	}

	.escanos {
		font-weight: 700;
	}

	@media (max-width: 640px) {
		.main {
			padding: 14px 14px 24px;
		}

		.titulo {
			font-size: 21px;
		}
	}
</style>
