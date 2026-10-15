<script lang="ts">
	import BarraEscanos from '#lib/components/BarraEscanos.svelte';
	import Hemiciclo from '#lib/components/Hemiciclo.svelte';
	import TablaPartidos from '#lib/components/TablaPartidos.svelte';
	import MapaProvincias from '#lib/components/MapaProvincias.svelte';
	import SimuladorTeaser from '#lib/components/SimuladorTeaser.svelte';
	import ProvinciasTeaser from '#lib/components/ProvinciasTeaser.svelte';
</script>

<main class="main">
	<div class="barra-section">
		<BarraEscanos />
	</div>

	<div class="grid">
		<div class="col-tabla">
			<TablaPartidos />
		</div>
		<div class="col-hemiciclo">
			<Hemiciclo />
		</div>
		<div class="col-mapa">
			<MapaProvincias />
		</div>
	</div>
</main>

<div class="teasers">
	<SimuladorTeaser />
	<ProvinciasTeaser />
</div>

<style>
	.main {
		padding: 20px 24px;
	}

	.barra-section {
		margin-bottom: 20px;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 20px;
		min-width: 0;
	}

	.col-tabla,
	.col-hemiciclo,
	.col-mapa {
		min-width: 0;
	}

	.col-tabla {
		order: 1;
	}

	.col-hemiciclo {
		order: 2;
		justify-self: center;
		width: 100%;
		max-width: 400px;
	}

	.col-mapa {
		order: 3;
	}

	.teasers {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	@media (max-width: 640px) {
		.main {
			padding: 16px;
		}
	}

	@media (min-width: 900px) {
		.grid {
			grid-template-columns: 1fr 1.3fr 1fr;
			gap: 24px;
			align-items: stretch;
		}

		.col-tabla {
			order: 1;
		}

		.col-hemiciclo {
			order: 2;
			justify-self: stretch;
			max-width: none;
		}

		.col-mapa {
			order: 3;
		}
	}
</style>
