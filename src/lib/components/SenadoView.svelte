<script lang="ts">
	import BarraSenado from '#lib/components/BarraSenado.svelte';
	import TablaSenado from '#lib/components/TablaSenado.svelte';
	import HemicicloSenado from '#lib/components/HemicicloSenado.svelte';
	import MapaTerritorios from '#lib/components/MapaTerritorios.svelte';
	import MapaMunicipiosSenado from '#lib/components/MapaMunicipiosSenado.svelte';
	import { getResultadosSenado, type ProvinciaSenado, type MunicipioIndice } from '#lib/data';
	import { CONVOCATORIA } from '#lib/config';
	import { etiquetaDe } from '#lib/empates';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	// A dónde lleva un municipio del buscador: a la vista de provincia **del
	// Senado**, no a la del Congreso, que es a donde va el motor por defecto.
	// Mismos parámetros que usa el Congreso (`?cod=` y `?muni=`), que es lo que
	// `SenadoProvinciasView` y `MapaMunicipiosSenado` saben leer.
	function irAMunicipioDelSenado(m: MunicipioIndice) {
		goto(`${resolve('/senado/provincias')}?cod=${m.codProv}&muni=${m.ine}`);
	}

	let comunidadesSenado = $state<Record<string, ProvinciaSenado> | null>(null);
	let provinciasSenado = $state<Record<string, ProvinciaSenado> | null>(null);

	$effect(() => {
		getResultadosSenado().then((d) => {
			comunidadesSenado = d.comunidades;
			provinciasSenado = d.provincias;
		});
	});
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
			<!-- `buscador` y `onMunicipio`, como el mapa del Congreso. El motor es el
			     mismo desde el principio; lo que le faltaba al Senado era activar el
			     buscador y decirle a dónde lleva un municipio encontrado: por defecto
			     va a `/provincias`, que es la vista del CONGRESO, así que buscar
			     "Alcalá" desde la cámara alta habría sacado al lector de ella. -->
			<MapaTerritorios
				comunidades={comunidadesSenado}
				provincias={provinciasSenado}
				buscador
				onMunicipio={irAMunicipioDelSenado}
				nota={`Senadores de elección directa — ${CONVOCATORIA} — busca tu municipio o pasa el ratón para ver el detalle. Gris = sin escrutar; en un empate a escaños se pinta el color del más votado y el popup lo indica`}
			>
				{#snippet popup(a)}
					<div class="popup-senado">
						<span class="popup-nombre">
							{a.nombre}
							{#if etiquetaDe(a.ganador)}
								<span class="popup-estado"> — {etiquetaDe(a.ganador)}</span>
							{/if}
						</span>
						{#if (a as ProvinciaSenado).composicion.length === 0}
							<span class="popup-vacio">Sin senadores electos todavía</span>
						{:else}
							{#each (a as ProvinciaSenado).composicion.slice(0, 4) as p (p.siglas)}
								<span class="popup-fila">
									<span class="popup-swatch" style="background:{p.color}"></span>
									<span class="popup-siglas">{p.siglas}</span>
									<span class="popup-escanos">{p.escanos}</span>
								</span>
							{/each}
						{/if}
					</div>
				{/snippet}

				{#snippet municipios(codProv)}
					<MapaMunicipiosSenado cod={codProv} />
				{/snippet}
			</MapaTerritorios>
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
	.popup-senado {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 170px;
	}

	.popup-nombre {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink, #0a0e14);
	}

	.popup-estado {
		font-weight: 400;
		text-transform: none;
		color: #9ca3af;
	}

	.popup-vacio {
		font-size: 10.5px;
		font-style: italic;
		color: #9ca3af;
	}

	.popup-fila {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10.5px;
	}

	.popup-swatch {
		width: 8px;
		height: 8px;
		flex: none;
		border: 1px solid #e5e7eb;
	}

	.popup-siglas {
		flex: 1;
		color: var(--ink, #0a0e14);
	}

	.popup-escanos {
		font-weight: 700;
		color: var(--ink, #0a0e14);
	}

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
