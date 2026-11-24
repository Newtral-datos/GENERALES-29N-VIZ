<script lang="ts">
	import { resolve } from '$app/paths';
	import { getResultados, type Provincia } from '#lib/data';
	import { formatMiles } from '#lib/format';

	// El teaser enseña el dato, no solo el enlace: cuántos escaños están de
	// verdad en disputa y por cuántos votos el más ajustado. Un reclamo con una
	// cifra real tira mucho más que uno genérico, y la cifra ya está en el JSON
	// que la home carga de todos modos (caché en memoria de data.ts), así que no
	// cuesta una petición extra.
	let provincias = $state<Record<string, Provincia> | null>(null);

	$effect(() => {
		getResultados().then((d) => {
			provincias = d.provincias;
		});
	});

	let batallas = $derived(
		Object.values(provincias ?? {})
			.map((p) => p.ultimoEscano)
			.filter((u): u is NonNullable<typeof u> => Boolean(u))
	);

	// "En disputa" = el hueco cabe en los votos que quedan por contar. Mismo
	// criterio que la vista, para que las dos cifras no se contradigan.
	let abiertas = $derived(
		batallas.filter((u) => u.censoSinEscrutar > 0 && u.votosFaltantes <= u.censoSinEscrutar)
	);
	let masAjustada = $derived(
		[...abiertas].sort((a, b) => a.votosFaltantes - b.votosFaltantes)[0] ?? null
	);
</script>

<a href={resolve('/batalla')} class="teaser">
	<div class="teaser-text">
		<span class="eyebrow">La batalla por el último escaño</span>
		<span class="headline">
			{#if abiertas.length}
				{abiertas.length}
				{abiertas.length === 1 ? 'escaño se decide' : 'escaños se deciden'} por unos pocos votos
			{:else}
				Dónde se decide un escaño por unos pocos votos
			{/if}
		</span>
		<span class="sub">
			{#if masAjustada}
				En la provincia más ajustada, <strong>{masAjustada.aspirante.siglas}</strong> está a
				{formatMiles(masAjustada.votosFaltantes)} votos de arrebatar un escaño a
				<strong>{masAjustada.tiene.siglas}</strong>
			{:else}
				Quién tiene el último escaño de cada provincia, quién se lo disputa y por cuántos
				votos
			{/if}
		</span>
	</div>

	<div class="teaser-viz">
		{#if masAjustada}
			<!-- Dos bandos y el hueco entre ellos: la misma lectura que la vista y en
			     el mismo sentido — el perseguidor a la izquierda y la flecha apuntando
			     a quien tiene el escaño. No es un gráfico, es un pictograma. -->
			<svg viewBox="0 0 120 56" class="mini" aria-hidden="true">
				<rect
					x="8"
					y="10"
					width="34"
					height="36"
					fill={masAjustada.aspirante.color}
					opacity="0.55"
				/>
				<rect x="78" y="10" width="34" height="36" fill={masAjustada.tiene.color} />
				<rect x="46" y="26" width="22" height="4" fill="rgba(255,255,255,0.3)" />
				<path d="M68 22 L76 28 L68 34 Z" fill="#fff" />
			</svg>
		{:else}
			<svg viewBox="0 0 120 56" class="mini" aria-hidden="true">
				<rect x="8" y="10" width="34" height="36" fill="rgba(255,255,255,0.18)" />
				<rect x="78" y="10" width="34" height="36" fill="rgba(255,255,255,0.1)" />
				<rect x="46" y="26" width="28" height="4" fill="rgba(255,255,255,0.2)" />
			</svg>
		{/if}
		<span class="cta">Ver la batalla <span class="arrow">→</span></span>
	</div>
</a>

<style>
	.teaser {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		background: var(--header-bg);
		color: #fff;
		padding: 28px 32px;
		text-decoration: none;
		border-top: 3px solid var(--c);
		transition: background 0.15s ease;
	}

	.teaser:hover {
		background: #1a1e26;
	}

	.teaser:hover .arrow {
		transform: translateX(4px);
	}

	.teaser-text {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.eyebrow {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--c);
	}

	.headline {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	.sub {
		font-family: var(--font-body);
		font-size: 13px;
		color: rgba(255, 255, 255, 0.65);
		max-width: 46ch;
	}

	.sub strong {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
	}

	.teaser-viz {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.mini {
		width: 96px;
		height: auto;
	}

	.cta {
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--c);
		white-space: nowrap;
		border: 1px solid var(--c);
		padding: 6px 10px;
		transition:
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}

	.teaser:hover .cta {
		box-shadow: 2px 2px 0 rgba(1, 243, 179, 0.3);
		transform: translate(-2px, -2px);
	}

	.arrow {
		transition: transform 0.15s ease;
	}

	@media (max-width: 640px) {
		.teaser {
			flex-direction: column;
			align-items: center;
			text-align: center;
			padding: 22px 16px;
			gap: 18px;
		}

		.teaser-text {
			align-items: center;
		}

		.headline {
			font-size: 20px;
		}

		.teaser-viz {
			align-self: center;
		}
	}
</style>
