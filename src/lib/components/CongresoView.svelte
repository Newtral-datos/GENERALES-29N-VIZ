<script lang="ts">
	import BarraEscanos from '#lib/components/BarraEscanos.svelte';
	import Hemiciclo from '#lib/components/Hemiciclo.svelte';
	import TablaPartidos from '#lib/components/TablaPartidos.svelte';
	import MapaTerritorios from '#lib/components/MapaTerritorios.svelte';
	import MapaMunicipios, { type MunicipioSeleccionado } from '#lib/components/MapaMunicipios.svelte';
	import { getResultados, type Provincia } from '#lib/data';
	import { CONVOCATORIA } from '#lib/config';
	import { etiquetaDe } from '#lib/empates';
	import { resolve } from '$app/paths';

	let comunidades = $state<Record<string, Provincia> | null>(null);
	let provincias = $state<Record<string, Provincia> | null>(null);
	let muniSel = $state<MunicipioSeleccionado | null>(null);

	$effect(() => {
		getResultados().then((d) => {
			comunidades = d.comunidades;
			provincias = d.provincias;
		});
	});
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
			<MapaTerritorios
				{comunidades}
				{provincias}
				buscador
				nota={`Partido ganador por circunscripción — ${CONVOCATORIA} — pasa el ratón para un vistazo, haz clic para ver el detalle completo. Gris = sin escrutar; rayado = empate`}
			>
				{#snippet popup(a)}
					<table class="popup-table">
						<thead>
							<tr>
								<th class="th-left popup-title-cell">
									{a.nombre}
									{#if etiquetaDe(a.ganador)}
										<span class="popup-estado">{etiquetaDe(a.ganador)}</span>
									{/if}
								</th>
								<th>Dip.</th>
								<th>% Voto</th>
							</tr>
						</thead>
						<tbody>
							{#each (a as Provincia).principales.slice(0, 3) as p (p.siglas)}
								<tr>
									<td class="popup-party">
										<span class="swatch" style="background:{p.color}"></span>
										{p.siglas}
									</td>
									<td class="popup-num">{p.escanos}</td>
									<td class="popup-num">
										{p.pctVotos.toLocaleString('es-ES', { minimumFractionDigits: 1 })}%
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/snippet}

				{#snippet municipios(codProv)}
					<MapaMunicipios cod={codProv} bind:seleccionado={muniSel} />
					{#if muniSel}
						<a
							class="ver-tabla"
							href={resolve('/provincias') + `?cod=${codProv}&muni=${muniSel.natcode.slice(-5)}`}
						>
							Ver la tabla completa de {muniSel.nombre} <span class="flecha">→</span>
						</a>
					{:else}
						<p class="pista-municipio">Toca un municipio para ver su detalle</p>
					{/if}
				{/snippet}
			</MapaTerritorios>
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
	/* Estilos del popup y del enlace al municipio: viven aquí porque aquí
	   están los snippets que los usan — Svelte aísla el CSS por componente y
	   desde MapaTerritorios no alcanzarían. */
	.popup-table {
		width: 100%;
		border-collapse: collapse;
	}
	.popup-table thead tr {
		border-bottom: 1px solid var(--border);
	}
	.popup-table th {
		padding: 0 0 4px 0;
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-align: right;
		color: var(--grey);
	}
	.popup-table th.th-left {
		text-align: left;
	}
	.popup-table td {
		padding: 2px 0;
		font-size: 11px;
	}
	.popup-title-cell {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink);
	}
	.popup-estado {
		/* Un empate o un 'sin escrutar' no se deduce del color de la región:
		   hay que poder leerlo. AGENTS.md pide dejarlo explícito en el popup. */
		display: block;
		font-weight: 400;
		font-size: 9px;
		color: #9ca3af;
		letter-spacing: 0.02em;
	}
	.popup-party {
		display: flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-body);
		color: var(--ink);
	}
	.swatch {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
	}
	.popup-num {
		text-align: right;
		font-family: var(--font-mono);
		color: var(--grey);
		font-variant-numeric: tabular-nums;
	}
	.ver-tabla {
		display: block;
		margin-top: 10px;
		padding: 7px 10px;
		background: var(--ink, #0a0e14);
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-align: center;
		text-decoration: none;
		/* Sombra de sello al pasar: es la firma de "esto es clicable" del
		   workspace, en vez de una sombra difuminada nueva. */
		transition: transform 0.12s ease;
	}
	.ver-tabla:hover {
		transform: translate(-2px, -2px);
		box-shadow: var(--shadow-hard, 2px 2px 0 rgba(10, 14, 20, 0.15));
	}
	.flecha {
		font-weight: 400;
	}
	.pista-municipio {
		margin: 10px 0 0;
		font-size: 9.5px;
		font-style: italic;
		text-align: center;
		color: #9ca3af;
	}

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
