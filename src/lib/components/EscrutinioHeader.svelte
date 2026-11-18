<script lang="ts">
	import logo from '#lib/assets/logo-newtral.png';
	import { ESCRUTINIO_ABIERTO, ESCRUTINIO_SIMULADO } from '#lib/config';
	import { getResultados } from '#lib/data';

	let escrutinio = $state(0);

	// Dato real de la jornada cuando el JSON lo trae (los del 29N llevan
	// `pctEscrutado` y `horaTotalizacion`; los de 23J no, porque ese escrutinio
	// está cerrado). Mientras no haya, se cae al valor simulado — marcado como
	// tal en config.ts.
	let objetivo = $state(ESCRUTINIO_SIMULADO);
	let esSimulado = $state(true);
	let horaDato = $state<string | null>(null);
	let fechaDato = $state<string | null>(null);

	$effect(() => {
		getResultados()
			.then((d) => {
				if (typeof d.nacional.pctEscrutado === 'number') {
					objetivo = d.nacional.pctEscrutado;
					esSimulado = false;
					horaDato = d.nacional.horaTotalizacion ?? null;
					fechaDato = d.nacional.fecha ?? null;
				}
			})
			.catch(() => {
				// Sin datos no se inventa nada: se queda el valor simulado, que ya
				// va rotulado como simulado en la UI.
			});
	});

	/**
	 * Fecha y hora del dato, las dos del propio fichero del Ministerio.
	 *
	 * La hora ya salía de `horaTotalizacion` —cuándo se totalizó el envío, que
	 * es lo que hay que contar—, pero la fecha venía de `new Date()`, o sea del
	 * reloj del visitante. Mezclar las dos fuentes da combinaciones imposibles:
	 * quien abriera el panel a las 02:00 del día siguiente vería la fecha de ese
	 * día con la hora del último envío de la noche anterior.
	 *
	 * La ISO se parte a mano en vez de `new Date('2026-11-29')`: esa cadena se
	 * interpreta como UTC y en husos negativos retrocede un día, que en una
	 * fecha electoral es justo el error que nadie perdona.
	 */
	function fechaEs(iso: string | null): string | null {
		if (!iso) return null;
		const [a, m, d] = iso.split('-');
		return a && m && d ? `${d}/${m}/${a}` : null;
	}

	let fechaActualizacion = $derived.by(() => {
		const fecha = fechaEs(fechaDato);
		// Sin dato de la jornada no se inventa un sello de tiempo: los JSON de
		// 23J no traen hora de totalización porque ese escrutinio está cerrado.
		if (!fecha || !horaDato) return 'Esperando datos de la jornada';
		return `Última actualización: ${fecha} — ${horaDato}h`;
	});

	$effect(() => {
		if (!ESCRUTINIO_ABIERTO) return;
		const destino = objetivo;
		const steps = 30;
		const inc = destino / steps;
		let step = 0;
		const t = setInterval(() => {
			step++;
			escrutinio = Math.min(destino, inc * step);
			if (step >= steps) clearInterval(t);
		}, 1000 / steps);
		return () => clearInterval(t);
	});
</script>

<header class="ticker">
	<div class="masthead">
		<span class="wordmark">Generales 29N</span>
		<span class="fecha-actualizacion">{fechaActualizacion}</span>
	</div>

	<div class="row">
		<span class="stamp">
			<span class="stamp-dot"></span>
			En directo
		</span>

		{#if ESCRUTINIO_ABIERTO}
			<span class="label">Escrutinio{#if esSimulado} <span class="aviso-simulado">(simulado)</span>{/if}</span>

			<span class="number">{escrutinio.toLocaleString('es-ES', { minimumIntegerDigits: 2, maximumFractionDigits: 1 })}<span class="number-unit">%</span></span>

			<div class="bar">
				<div class="fill" style="width:{escrutinio}%"></div>
				<div class="ticks">
					{#each [25, 50, 75] as t (t)}
						<span class="tick" style="left:{t}%"></span>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<span class="logo-badge">
		<img class="logo" src={logo} alt="Newtral" />
	</span>
</header>

<style>
	.ticker {
		background: var(--paper);
		color: var(--ink);
		position: sticky;
		top: 0;
		z-index: 50;
		width: 100%;
	}

	.masthead {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 7px 20px 0;
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.fecha-actualizacion {
		font-family: var(--font-body);
		font-size: 12px;
		font-style: italic;
		color: rgba(10, 14, 20, 0.5);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 7px 110px 4px 20px;
	}

	.stamp {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 6px;
		border: 1px solid var(--stamp);
		color: var(--stamp);
		font-family: var(--font-display);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.stamp-dot {
		width: 4px;
		height: 4px;
		background: var(--stamp);
		flex-shrink: 0;
	}

	.aviso-simulado {
		/* Un dato inventado nunca debe poder pasar por real (AGENTS.md): el
		   rótulo desaparece solo cuando el JSON trae `pctEscrutado`. */
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		opacity: 0.75;
	}

	.label {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(10, 14, 20, 0.5);
		flex-shrink: 0;
	}

	.number {
		font-family: var(--font-mono);
		font-size: 32px;
		font-weight: 700;
		color: var(--c);
		letter-spacing: -0.01em;
		line-height: 1;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.number-unit {
		font-size: 18px;
		font-weight: 500;
		color: rgba(1, 243, 179, 0.6);
		margin-left: 1px;
	}

	.bar {
		flex: 1;
		position: relative;
		height: 8px;
		background: rgba(10, 14, 20, 0.08);
	}

	.logo-badge {
		position: absolute;
		top: 50%;
		right: 20px;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
	}

	.logo {
		height: 16px;
		width: auto;
		display: block;
	}

	.fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--c);
		transition: width 1s ease-out;
	}

	.ticks {
		position: absolute;
		inset: 0;
	}

	.tick {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--paper);
	}

	@media (max-width: 640px) {
		.masthead {
			padding: 8px 16px 0;
		}

		.row {
			padding: 8px 100px 4px 16px;
			gap: 10px;
			flex-wrap: wrap;
		}

		.number {
			font-size: 28px;
		}

		.bar {
			order: 3;
			flex-basis: 100%;
			height: 8px;
		}

		.logo-badge {
			right: 16px;
		}
	}
</style>
