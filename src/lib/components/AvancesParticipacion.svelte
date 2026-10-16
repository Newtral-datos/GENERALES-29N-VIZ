<script lang="ts">
	import { formatMiles } from '#lib/format';
	import type { ParticipacionNacional } from '#lib/data';

	// activeIdx viene de ParticipacionView: es el mismo índice que usan el
	// mapa y el ranking, para que todo el bloque de participación se mueva
	// junto según avanza la jornada.
	let { nacional, activeIdx }: { nacional: ParticipacionNacional; activeIdx: number } = $props();

	let activo = $derived(activeIdx >= 0 ? nacional.avances[activeIdx] : null);

	let delta = $derived.by(() => {
		if (!activo || activo.participacionPct === null || activo.participacionPctAnterior === null) return null;
		return Math.round((activo.participacionPct - activo.participacionPctAnterior) * 100) / 100;
	});

	function deltaDe(a: (typeof nacional.avances)[number]): number | null {
		if (a.participacionPct === null || a.participacionPctAnterior === null) return null;
		return Math.round((a.participacionPct - a.participacionPctAnterior) * 100) / 100;
	}
</script>

{#if activo}
	<div class="hero">
		<span class="hero-valor"
			>{activo.participacionPct!.toLocaleString('es-ES', { minimumFractionDigits: 2 })}<span class="hero-unit">%</span></span
		>
		<span class="hero-sub">{formatMiles(activo.votantes!)} votantes de {formatMiles(nacional.censo)} censados</span>
	</div>

	<div class="avances-grid">
		{#each nacional.avances as a (a.hora)}
			{@const d = deltaDe(a)}
			{@const pendiente = a.participacionPct === null}
			<div class="avance-box" class:activo={a === activo} class:pendiente>
				<span class="avance-hora">{a.hora}</span>
				<span class="avance-valor">
					{pendiente ? '—' : `${a.participacionPct!.toLocaleString('es-ES', { minimumFractionDigits: 2 })}%`}
				</span>
				{#if pendiente}
					<span class="avance-delta sin-dato">Pendiente</span>
				{:else if d !== null}
					<span class="avance-delta" class:up={d > 0} class:down={d < 0}>
						{d > 0 ? '+' : ''}{d.toLocaleString('es-ES', { minimumFractionDigits: 2 })} vs 2019
					</span>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<p class="esperando">Esperando el primer avance de participación…</p>
{/if}

<style>
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		text-align: center;
	}

	.hero-valor {
		font-family: var(--font-display);
		font-size: 56px;
		font-weight: 800;
		color: var(--c);
		letter-spacing: -0.02em;
		line-height: 0.7;
		margin-top: -14px;
		margin-bottom: 10px;
	}

	.hero-unit {
		font-size: 28px;
		font-weight: 600;
		color: var(--grey);
		margin-left: 2px;
	}

	.hero-sub {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--grey);
		margin-top: 2px;
	}

	.esperando {
		text-align: center;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--grey);
		font-style: italic;
		padding: 20px 0;
	}

	.avances-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-top: 20px;
	}

	.avance-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 12px 8px;
		border: 1px solid var(--border);
		background: var(--paper);
	}

	.avance-box.pendiente {
		border-style: dashed;
		border-color: var(--rule);
		opacity: 0.6;
	}

	.avance-box.activo {
		background: var(--ink);
		border-color: var(--ink);
	}

	.avance-hora {
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grey);
	}

	.avance-box.activo .avance-hora {
		color: rgba(255, 255, 255, 0.6);
	}

	.avance-valor {
		font-family: var(--font-mono);
		font-size: 20px;
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.avance-box.activo .avance-valor {
		color: var(--c);
	}

	.avance-delta {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--grey);
	}

	.avance-delta.up {
		color: #0a7a4a;
	}

	.avance-delta.down {
		color: var(--stamp);
	}

	.avance-delta.sin-dato {
		font-family: var(--font-body);
		font-weight: 500;
		font-style: italic;
	}

	.avance-box.activo .avance-delta.up {
		color: var(--c);
	}

	.avance-box.activo .avance-delta.down {
		color: #ff8a80;
	}

	@media (max-width: 640px) {
		.hero-valor {
			font-size: 44px;
		}

		.hero-unit {
			font-size: 22px;
		}

		.avance-valor {
			font-size: 17px;
		}
	}
</style>
