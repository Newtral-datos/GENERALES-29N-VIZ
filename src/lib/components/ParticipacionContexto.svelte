<script lang="ts">
	import { resolve } from '$app/paths';
	import { getParticipacion, type ParticipacionNacional } from '#lib/data';
	import { avanceActivo } from '#lib/participacion';
	import { CONVOCATORIA_ANTERIOR } from '#lib/config';

	/**
	 * La participación del último corte publicado, para dar contexto en las
	 * portadas de Congreso y Senado.
	 *
	 * Es un dato de la jornada que esas dos vistas no tenían y que cambia cómo se
	 * leen los escaños: un reparto con el 50 % de participación no dice lo mismo
	 * que con el 75 %. Y durante la tarde, entre el primer avance y el cierre de
	 * urnas, es **lo único que hay**.
	 *
	 * Qué corte es el bueno lo decide `#lib/participacion`, el mismo módulo que
	 * usa la vista de participación: con cada pieza calculándolo por su cuenta,
	 * esta cifra y la de esa vista podían quedarse en cortes distintos (norma del
	 * AGENTS.md).
	 *
	 * No se dibuja nada si todavía no hay ningún avance: antes del primero, lo
	 * honesto es no decir nada, no decir 0 %.
	 */

	let nacional = $state<ParticipacionNacional | null>(null);

	$effect(() => {
		getParticipacion().then((d) => {
			nacional = d.nacional;
		});
	});

	let avance = $derived(avanceActivo(nacional));
	let pct = $derived(avance?.participacionPct ?? null);

	// Diferencia con el mismo corte de la convocatoria anterior, que es la
	// comparación que da la medida. `null` = no comparable, y entonces no se
	// enseña — nunca un `+0,0` que parezca un empate.
	let delta = $derived(
		avance && pct !== null && avance.participacionPctAnterior !== null
			? Math.round((pct - avance.participacionPctAnterior) * 100) / 100
			: null
	);

	// "Cierre" ya se entiende solo; los avances se nombran por su hora.
	let cuando = $derived(
		avance ? (avance.hora === 'Cierre' ? 'al cierre de las urnas' : `a las ${avance.hora}`) : ''
	);
</script>

{#if pct !== null && avance}
	<!-- En prosa y sin card: es una línea de contexto, no una pieza de datos más.
	     El AGENTS.md pide no envolver nada en tarjetas si no se ha pedido. -->
	<p class="contexto">
		<span class="etiqueta">Participación</span>
		<a class="cifra" href={resolve('/participacion')}>
			{pct.toLocaleString('es-ES', { minimumFractionDigits: 1 })} %
		</a>
		<span class="detalle">
			{cuando}{#if avance.recuperado}, del envío anterior{/if}
			{#if delta !== null}
				— <span class="delta" class:sube={delta > 0} class:baja={delta < 0}>
					{delta > 0 ? '+' : ''}{delta.toLocaleString('es-ES', { minimumFractionDigits: 1 })} pts
				</span>
				que en {CONVOCATORIA_ANTERIOR}
			{/if}
		</span>
	</p>
{/if}

<style>
	.contexto {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 4px 8px;
		margin: 0 0 14px;
		font-family: var(--font-body);
		font-size: 12px;
		line-height: 1.4;
		color: var(--grey);
	}

	.etiqueta {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	/* La cifra enlaza a la vista de participación: quien se fija en este número
	   es exactamente quien querrá el desglose. */
	.cifra {
		font-size: 17px;
		font-weight: 800;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
		text-decoration: none;
		border-bottom: 2px solid var(--c);
	}

	.cifra:hover {
		background: var(--c);
	}

	.detalle {
		min-width: 0;
	}

	/* Sube en el teal oscuro y baja en el rojo de sello, que es el par que ya usa
	   el resto del panel para los deltas. */
	.delta {
		font-weight: 700;
	}

	.delta.sube {
		color: var(--cd);
	}

	.delta.baja {
		color: var(--stamp);
	}
</style>
