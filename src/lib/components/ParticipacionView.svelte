<script lang="ts">
	import { resolve } from '$app/paths';
	import { getParticipacion23j, type ParticipacionNacional } from '#lib/data';
	import { ESCRUTINIO_ABIERTO } from '#lib/config';
	import MapaParticipacion from '#lib/components/MapaParticipacion.svelte';
	import RankingParticipacion from '#lib/components/RankingParticipacion.svelte';
	import AvancesParticipacion from '#lib/components/AvancesParticipacion.svelte';

	let nacional = $state<ParticipacionNacional | null>(null);

	$effect(() => {
		getParticipacion23j().then((d) => {
			nacional = d.nacional;
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
</main>

<style>
	.main {
		padding: 20px 24px 32px;
		max-width: 900px;
		margin: 0 auto;
	}

	.volver {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--ink);
		text-decoration: none;
		border: 1.5px solid var(--ink);
		padding: 7px 12px;
		margin-bottom: 16px;
		background: var(--paper);
		transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease, color 0.15s ease;
	}

	.volver:hover {
		background: var(--c);
		color: var(--ink);
		box-shadow: var(--shadow-hard-lift);
		transform: translate(-2px, -2px);
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
