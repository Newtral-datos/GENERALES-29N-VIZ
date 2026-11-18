<script lang="ts">
	import { resolve } from '$app/paths';
	import { getParticipacion, type ParticipacionNacional } from '#lib/data';
	import { ESCRUTINIO_ABIERTO } from '#lib/config';
	import MapaParticipacion from '#lib/components/MapaParticipacion.svelte';
	import RankingParticipacion from '#lib/components/RankingParticipacion.svelte';
	import AvancesParticipacion from '#lib/components/AvancesParticipacion.svelte';
	import MapaParticipacionMunicipios from '#lib/components/MapaParticipacionMunicipios.svelte';

	let nacional = $state<ParticipacionNacional | null>(null);
	let provincias = $state<Record<string, { nombre: string }> | null>(null);

	// Provincia del mapa municipal. Se elige una porque la geometría municipal
	// se sirve por provincia (52 ficheros, ~4 MB en total): traerlas todas para
	// enseñar una sola sería absurdo. Madrid de salida por ser la de más censo.
	let codProv = $state('28');

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
			<MapaParticipacion {activeIdx} />
		</div>
		<div class="col-ranking">
			<RankingParticipacion {activeIdx} />
		</div>
	</div>

	<div class="municipios">
		<div class="selector-fila">
			<label class="selector-label" for="prov-municipios">Provincia</label>
			<select id="prov-municipios" class="selector" bind:value={codProv}>
				{#each Object.entries(provincias ?? {}).sort( (a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es') ) as [cod, p] (cod)}
					<option value={cod}>{p.nombre}</option>
				{/each}
			</select>
		</div>

		<MapaParticipacionMunicipios cod={codProv} {activeIdx} />
	</div>
</main>

<style>
	.municipios {
		margin-top: 20px;
		min-width: 0;
	}

	.selector-fila {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	.selector-label {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.selector {
		padding: 5px 8px;
		font: inherit;
		font-size: 11px;
		color: var(--ink, #0a0e14);
		background: #fff;
		border: 1px solid #e5e7eb;
		/* Esquinas rectas, como el resto de cards del workspace. */
		border-radius: 0;
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
