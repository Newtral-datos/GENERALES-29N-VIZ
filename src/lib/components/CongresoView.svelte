<script lang="ts">
	import BarraEscanos from '#lib/components/BarraEscanos.svelte';
	import Hemiciclo from '#lib/components/Hemiciclo.svelte';
	import TablaPartidos from '#lib/components/TablaPartidos.svelte';
	import MapaTerritorios from '#lib/components/MapaTerritorios.svelte';
	import SimuladorTeaser from '#lib/components/SimuladorTeaser.svelte';
	import ProvinciasTeaser from '#lib/components/ProvinciasTeaser.svelte';
	import ParticipacionTeaser from '#lib/components/ParticipacionTeaser.svelte';
	import CompartirResultados from '#lib/components/CompartirResultados.svelte';
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
			<MapaTerritorios />
		</div>
	</div>

	<div class="compartir-section">
		<CompartirResultados />
	</div>
</main>

<div class="teasers">
	<SimuladorTeaser />
	<ProvinciasTeaser />
	<ParticipacionTeaser />
</div>

<style>
	.main {
		padding: 20px 24px;
	}

	.barra-section {
		margin-bottom: 20px;
	}

	/* Solo en móvil. En escritorio el botón no puede hacer lo que promete:
	   ninguna red deja adjuntar una imagen por URL y ninguna web puede meterle
	   contenido al compositor de otra, así que lo máximo desde el navegador es
	   copiar la imagen al portapapeles y pedir que se pegue a mano. En el móvil
	   sí hay `navigator.share` nativo, que entrega imagen y texto directamente a
	   la app que elija quien comparte — que es el caso de uso real de esta
	   portada. Ver #lib/compartir-imagen.

	   Se oculta por CSS y no por JS a propósito: el panel se prerenderiza, y
	   decidir esto en el cliente dejaría el botón parpadeando al hidratar. */
	.compartir-section {
		display: none;
	}

	@media (max-width: 640px) {
		.compartir-section {
			display: flex;
			justify-content: center;
			margin-top: 20px;
		}
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
		grid-template-columns: 1fr;
	}

	@media (min-width: 900px) {
		.teasers {
			grid-template-columns: 1fr 1fr 1fr;
		}
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
