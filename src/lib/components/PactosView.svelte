<script lang="ts">
	import { resolve } from '$app/paths';
	import SimuladorPactos from '#lib/components/SimuladorPactos.svelte';
</script>

<main class="main">
	<a href={resolve('/')} class="volver">← Volver al Congreso</a>

	<div class="intro">
		<p class="kicker">Simulador de pactos</p>
		<h1 class="titulo">¿Quién sumará los 176 escaños?</h1>
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
		display: inline-block;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		color: var(--grey);
		text-decoration: none;
		margin-bottom: 16px;
	}

	.volver:hover {
		color: var(--ink);
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
