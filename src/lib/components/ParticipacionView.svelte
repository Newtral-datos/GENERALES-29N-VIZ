<script lang="ts">
	import { resolve } from '$app/paths';
	import { getParticipacion23j, type ParticipacionNacional } from '#lib/data';
	import { formatMiles } from '#lib/format';
	import MapaParticipacion from '#lib/components/MapaParticipacion.svelte';
	import RankingParticipacion from '#lib/components/RankingParticipacion.svelte';

	let nacional = $state<ParticipacionNacional | null>(null);

	$effect(() => {
		getParticipacion23j().then((d) => {
			nacional = d.nacional;
		});
	});
</script>

<main class="main">
	<a href={resolve('/')} class="volver">← Volver al Congreso</a>

	<div class="intro">
		<p class="kicker">Participación electoral</p>
		<h1 class="titulo">¿Cuánta gente ha votado?</h1>
	</div>

	{#if nacional}
		{@const delta = Math.round((nacional.participacionPct - nacional.participacionPctAnterior) * 100) / 100}
		<div class="hero">
			<span class="hero-valor">{nacional.participacionPct.toLocaleString('es-ES', { minimumFractionDigits: 2 })}<span class="hero-unit">%</span></span>
			<span class="hero-label">Participación nacional — 23J</span>
			<span class="hero-sub">{formatMiles(nacional.votantes)} votantes de {formatMiles(nacional.censo)} censados</span>
			<span class="hero-delta" class:up={delta > 0} class:down={delta < 0}>
				{delta > 0 ? '+' : ''}{delta.toLocaleString('es-ES', { minimumFractionDigits: 2 })} pts vs 2019 ({nacional.participacionPctAnterior.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%)
			</span>
		</div>
	{/if}

	<div class="grid">
		<div class="col-mapa">
			<MapaParticipacion />
		</div>
		<div class="col-ranking">
			<RankingParticipacion />
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

	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		text-align: center;
		padding: 16px 0 24px;
	}

	.hero-valor {
		font-family: var(--font-display);
		font-size: 56px;
		font-weight: 800;
		color: var(--c);
		letter-spacing: -0.02em;
		line-height: 1;
	}

	.hero-unit {
		font-size: 28px;
		font-weight: 600;
		color: var(--grey);
		margin-left: 2px;
	}

	.hero-label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grey);
		margin-top: 6px;
	}

	.hero-sub {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--grey);
		margin-top: 2px;
	}

	.hero-delta {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--grey);
		margin-top: 8px;
	}

	.hero-delta.up {
		color: #0a7a4a;
	}

	.hero-delta.down {
		color: var(--stamp);
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

		.hero-valor {
			font-size: 44px;
		}

		.hero-unit {
			font-size: 22px;
		}
	}
</style>
