<script lang="ts">
	import { resolve } from '$app/paths';
	import { getParticipacion, type ParticipacionNacional } from '#lib/data';
	import { ESCRUTINIO_ABIERTO } from '#lib/config';
	import MapaParticipacion from '#lib/components/MapaParticipacion.svelte';
	import RankingParticipacion from '#lib/components/RankingParticipacion.svelte';
	import AvancesParticipacion from '#lib/components/AvancesParticipacion.svelte';
	import MapaParticipacionMunicipios from '#lib/components/MapaParticipacionMunicipios.svelte';
	import SelectorProvincia from '#lib/components/SelectorProvincia.svelte';

	let nacional = $state<ParticipacionNacional | null>(null);
	let provincias = $state<Record<string, { nombre: string }> | null>(null);

	// Provincia del mapa municipal, sin ninguna elegida de salida. La geometría
	// municipal se sirve por provincia, así que hay que elegir una — pero
	// arrancar en Madrid daba a entender que Madrid es el caso por defecto de
	// algo, y no lo es: es una provincia más. Mejor que el lector elija.
	let codProv = $state('');
	let zonaMunicipios = $state<HTMLDivElement | null>(null);

	/**
	 * Pulsar una provincia en el mapa equivale a elegirla en el selector.
	 *
	 * Y además lleva la vista hasta el mapa municipal: sin eso el clic parece
	 * que no ha hecho nada, porque lo que cambia está más abajo, fuera de la
	 * pantalla. Scroll suave y no instantáneo para que se entienda que te has
	 * movido tú, no que la página ha saltado.
	 *
	 * `block: 'end'` en vez de `'start'`: alinea el final del bloque con el pie
	 * de la ventana, así el mapa municipal queda entero a la vista. Con
	 * `'start'` se paraba en el selector y el mapa —que es lo que se ha pedido
	 * ver— seguía asomando por debajo.
	 *
	 * El scroll no se lanza al pulsar sino cuando el mapa avisa de que ya está
	 * pintado (`onListo`). La geometría municipal se carga por fetch, así que
	 * en el momento del clic el bloque solo contiene el texto de "cargando":
	 * al colocar el scroll ahí y llegar después el mapa, el contenido crecía
	 * 500 px y la vista se quedaba a media altura.
	 */
	function elegirProvincia(cod: string) {
		codProv = cod;
	}

	function bajarAlMapa() {
		zonaMunicipios?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}

	$effect(() => {
		getParticipacion().then((d) => {
			nacional = d.nacional;
			provincias = d.provincias;
		});
	});

	// Qué avance manda en todo el bloque de participación (cajitas, mapa y
	// ranking a la vez): el último publicado a nivel nacional. Se calcula una
	// sola vez aquí y se reparte hacia abajo para que todo el bloque se mueva
	// junto según avanza la jornada, no cada pieza por su cuenta.
	let activeIdx = $derived.by(() => {
		if (!nacional) return -1;
		let idx = -1;
		nacional.avances.forEach((a, i) => {
			if (a.participacionPct !== null) idx = i;
		});
		return idx;
	});
</script>

<main class="main">
	{#if ESCRUTINIO_ABIERTO}
		<a href={resolve('/')} class="volver">← Volver al Congreso</a>
	{/if}

	<div class="intro">
		<p class="kicker">Participación electoral</p>
		<h1 class="titulo">¿Cuánta gente ha votado?</h1>
	</div>

	{#if nacional}
		<div class="hero-wrap">
			<AvancesParticipacion {nacional} {activeIdx} />
		</div>
	{/if}

	<div class="grid">
		<div class="col-mapa">
			<MapaParticipacion {activeIdx} onElegir={elegirProvincia} />
		</div>
		<div class="col-ranking">
			<RankingParticipacion {activeIdx} />
		</div>
	</div>

	<div class="municipios" bind:this={zonaMunicipios}>
		<SelectorProvincia {provincias} bind:cod={codProv} />

		{#if codProv}
			<MapaParticipacionMunicipios cod={codProv} {activeIdx} onListo={bajarAlMapa} />
		{:else}
			<p class="sin-provincia">
				Elige una provincia para ver la participación de cada uno de sus municipios
			</p>
		{/if}
	</div>
</main>

<style>
	.municipios {
		margin-top: 20px;
		min-width: 0;
	}



	.sin-provincia {
		margin: 0;
		padding: 28px 16px;
		text-align: center;
		font-size: 11px;
		color: #9ca3af;
		background: #fff;
		border: 1px solid #e5e7eb;
	}


	.main {
		padding: 20px 24px 32px;
		max-width: 900px;
		margin: 0 auto;
	}

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
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--c);
		margin: 0 0 6px 0;
	}

	.titulo {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 800;
		color: var(--ink);
		margin: 0 0 10px 0;
	}

	.hero-wrap {
		padding: 0 0 20px;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 24px;
	}

	.col-mapa,
	.col-ranking {
		min-width: 0;
	}

	@media (min-width: 760px) {
		.grid {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}

	@media (max-width: 640px) {
		.main {
			padding: 16px 16px 32px;
		}

		.titulo {
			font-size: 19px;
		}
	}
</style>
