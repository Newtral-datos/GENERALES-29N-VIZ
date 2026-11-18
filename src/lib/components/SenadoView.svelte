<script lang="ts">
	import BarraSenado from '#lib/components/BarraSenado.svelte';
	import TablaSenado from '#lib/components/TablaSenado.svelte';
	import HemicicloSenado from '#lib/components/HemicicloSenado.svelte';
	import MapaSenado from '#lib/components/MapaSenado.svelte';
	import ProvinciasSenadoTeaser from '#lib/components/ProvinciasSenadoTeaser.svelte';
	import ParticipacionTeaser from '#lib/components/ParticipacionTeaser.svelte';
</script>

<main class="main">
	<div class="barra-section">
		<BarraSenado />
	</div>

	<div class="grid">
		<div class="col-tabla">
			<TablaSenado />
		</div>
		<div class="col-hemiciclo">
			<HemicicloSenado />
		</div>
		<div class="col-mapa">
			<MapaSenado />
		</div>
	</div>
</main>

<!-- Los mismos accesos que al pie del Congreso, menos el simulador de pactos:
     la investidura se vota en el Congreso, así que ahí no pinta nada. El de
     participación es literalmente el mismo componente — la participación es
     común a las dos cámaras, no hay avances propios del Senado. -->
<div class="teasers">
	<ProvinciasSenadoTeaser />
	<ParticipacionTeaser />
</div>

<style>
	.teasers {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0;
	}

	@media (max-width: 640px) {
		.teasers {
			grid-template-columns: 1fr;
		}
	}

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
	}
</style>
