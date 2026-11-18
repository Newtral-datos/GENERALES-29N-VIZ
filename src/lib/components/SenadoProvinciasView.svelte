<script lang="ts">
	import { resolve } from '$app/paths';
	import { getResultadosSenado, type ProvinciaSenado } from '#lib/data';
	import MapaMunicipiosSenado from '#lib/components/MapaMunicipiosSenado.svelte';

	let provincias = $state<Record<string, ProvinciaSenado> | null>(null);

	// Madrid de salida, por ser la de más censo. La geometría municipal se sirve
	// por provincia, así que hay que elegir una: traer las 52 para enseñar una
	// sería ~4 MB desperdiciados.
	let cod = $state('28');

	$effect(() => {
		getResultadosSenado().then((d) => {
			provincias = d.provincias;
		});
	});

	let activa = $derived(provincias?.[cod] ?? null);
</script>

<main class="main">
	<div class="volver-fila">
		<a href={resolve('/senado')} class="volver">← Volver al Senado</a>
	</div>

	<div class="intro">
		<p class="kicker">Senado por provincia y municipio</p>
		<h1 class="titulo">Cómo ha votado tu provincia al Senado</h1>
		<p class="entradilla">
			En el Senado se vota a personas, no a listas: cada votante marca hasta tres
			candidatos y salen los más votados de la circunscripción, sean del partido que
			sean. Por eso aquí no hay escaños por municipio — solo qué partido ha sido el
			más votado en cada uno.
		</p>
	</div>

	<div class="selector-fila">
		<label class="selector-label" for="prov-senado">Provincia</label>
		<select id="prov-senado" class="selector" bind:value={cod}>
			{#each Object.entries(provincias ?? {}).sort( (a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es') ) as [c, p] (c)}
				<option value={c}>{p.nombre}</option>
			{/each}
		</select>
	</div>

	{#if activa}
		<section class="panel">
			<p class="panel-kicker">Senadores electos en {activa.nombre}</p>
			<div class="panel-body">
				{#if activa.composicion.length === 0}
					<p class="vacio">Sin senadores electos todavía</p>
				{:else}
					<ul class="composicion">
						{#each activa.composicion as p (p.siglas)}
							<li>
								<span class="swatch" style="background:{p.color}"></span>
								<span class="siglas">{p.siglas}</span>
								<span class="escanos">{p.escanos}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/if}

	<MapaMunicipiosSenado {cod} />
</main>

<style>
	.main {
		padding: 20px 24px 32px;
		max-width: 900px;
		margin: 0 auto;
		min-width: 0;
	}

	.volver-fila {
		margin-bottom: 14px;
	}

	.volver {
		font-size: 11px;
		font-weight: 700;
		color: var(--ink, #0a0e14);
		text-decoration: none;
	}

	.volver:hover {
		text-decoration: underline;
	}

	.intro {
		text-align: center;
		margin-bottom: 18px;
	}

	.kicker {
		margin: 0 0 4px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--cd, #00b38a);
	}

	.titulo {
		margin: 0 0 8px;
		font-size: 26px;
		line-height: 1.15;
	}

	.entradilla {
		margin: 0 auto;
		max-width: 620px;
		font-size: 12px;
		line-height: 1.5;
		color: #6b7280;
	}

	.selector-fila {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 14px;
	}

	.selector-label {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.selector {
		padding: 5px 8px;
		font: inherit;
		font-size: 11px;
		color: var(--ink, #0a0e14);
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0;
	}

	.panel {
		background: #fff;
		border: 1px solid #e5e7eb;
		margin-bottom: 16px;
		min-width: 0;
	}

	.panel-kicker {
		margin: 0;
		padding: 7px 0;
		background: #fafafa;
		border-bottom: 1px solid #f0f0f0;
		border-left: 3px solid var(--c, #01f3b3);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #9ca3af;
		text-align: center;
	}

	.panel-body {
		padding: 14px 20px;
	}

	.vacio {
		margin: 0;
		padding: 10px 0;
		text-align: center;
		font-style: italic;
		color: #9ca3af;
		font-size: 11px;
	}

	.composicion {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.composicion li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}

	.swatch {
		width: 10px;
		height: 10px;
		border: 1px solid #e5e7eb;
	}

	.escanos {
		font-weight: 700;
	}

	@media (max-width: 640px) {
		.main {
			padding: 14px 14px 24px;
		}

		.titulo {
			font-size: 21px;
		}
	}
</style>
