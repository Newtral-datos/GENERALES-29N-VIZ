<script lang="ts">
	import BarraEscanos from '#lib/components/BarraEscanos.svelte';
	import Hemiciclo from '#lib/components/Hemiciclo.svelte';
	import TablaPartidos from '#lib/components/TablaPartidos.svelte';
	import MapaProvincias from '#lib/components/MapaProvincias.svelte';
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

<style>
	.main {
		padding: 32px 24px;
	}

	.barra-section {
		margin-bottom: 32px;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 32px;
		min-width: 0;
	}

	.col-tabla,
	.col-hemiciclo,
	.col-mapa {
		min-width: 0;
		order: 2;
	}

	.col-hemiciclo {
		order: 1;
		justify-self: center;
		width: 100%;
		max-width: 480px;
	}

	@media (max-width: 640px) {
		.main {
			padding: 16px;
		}
	}

	@media (min-width: 900px) {
		.grid {
			grid-template-columns: 1fr 1.3fr 1fr;
			gap: 32px;
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
