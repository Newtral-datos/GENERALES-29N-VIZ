<script lang="ts">
	import BarraSenado from '#lib/components/BarraSenado.svelte';
	import TablaSenado from '#lib/components/TablaSenado.svelte';
	import MapaSenado from '#lib/components/MapaSenado.svelte';
</script>

<main class="main">
	<div class="barra-section">
		<BarraSenado />
	</div>

	<div class="grid">
		<div class="col-tabla">
			<TablaSenado />
		</div>
		<div class="col-mapa">
			<MapaSenado />
		</div>
	</div>
</main>

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
	.col-mapa {
		min-width: 0;
	}

	@media (max-width: 640px) {
		.main {
			padding: 16px;
		}
	}

	@media (min-width: 900px) {
		.grid {
			grid-template-columns: 1fr 1.3fr;
			gap: 24px;
			align-items: stretch;
		}
	}
</style>
