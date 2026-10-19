<script lang="ts">
	import { resolve } from '$app/paths';
	import SimuladorPactos from '#lib/components/SimuladorPactos.svelte';
</script>

<main class="main">
	<a href={resolve('/')} class="volver">← Volver al Congreso</a>

	<div class="intro">
		<p class="kicker">Simulador de pactos</p>
		<h1 class="titulo">¿Quién sumará los 176 escaños?</h1>
		<p class="lead">Selecciona primero a quien crees líder del Gobierno.</p>
	</div>

	<SimuladorPactos />
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

	.lead {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--grey);
		max-width: 56ch;
		margin: 0 auto;
	}

	@media (max-width: 640px) {
		.main {
			padding: 16px 16px 32px;
		}

		.titulo {
			font-size: 18px;
		}
	}
</style>
