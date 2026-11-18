<script lang="ts">
	import logo from '#lib/assets/logo-newtral.png';
	import { ESCRUTINIO_ABIERTO, ESCRUTINIO_SIMULADO } from '#lib/config';
	import { getResultados, getParticipacion } from '#lib/data';

	let escrutinio = $state(0);

	// Dato real de la jornada cuando el JSON lo trae (los del 29N llevan
	// `pctEscrutado` y `horaTotalizacion`; los de 23J no, porque ese escrutinio
	// está cerrado). Mientras no haya, se cae al valor simulado — marcado como
	// tal en config.ts.
	let objetivo = $state(ESCRUTINIO_SIMULADO);
	let esSimulado = $state(true);
	let sello = $state<Sello | null>(null);

	/**
	 * El sello de tiempo sale del fichero que se haya actualizado más tarde.
	 *
	 * Entre las 8:00 y las 20:00 del 29N el escrutinio no ha empezado y lo único
	 * que se regenera es `participacion29n.json`; a partir de las 20:00 manda el
	 * de resultados. Mirando solo uno de los dos, el faldón se queda con la hora
	 * congelada media jornada — que es justo lo que pasaba.
	 */
	function masReciente(a: Sello | null, b: Sello | null): Sello | null {
		if (!a?.fecha || !a?.hora) return b;
		if (!b?.fecha || !b?.hora) return a;
		return `${b.fecha} ${b.hora}` > `${a.fecha} ${a.hora}` ? b : a;
	}

	type Sello = { fecha: string | null; hora: string | null };

	$effect(() => {
		// El % de escrutinio solo lo da el fichero de resultados; la hora puede
		// venir de cualquiera de los dos.
		getResultados()
			.then((d) => {
				if (typeof d.nacional.pctEscrutado === 'number') {
					objetivo = d.nacional.pctEscrutado;
					esSimulado = false;
				}
				sello = masReciente(sello, {
					fecha: d.nacional.fecha ?? null,
					hora: d.nacional.horaTotalizacion ?? null
				});
			})
			.catch(() => {
				// Sin datos no se inventa nada: se queda el valor simulado, que ya
				// va rotulado como simulado en la UI.
			});

		getParticipacion()
			.then((d) => {
				sello = masReciente(sello, {
					fecha: d.nacional.fecha ?? null,
					hora: d.nacional.horaTotalizacion ?? null
				});
			})
			.catch(() => {});
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
		const fecha = fechaEs(sello?.fecha ?? null);
		// Sin dato de la jornada no se inventa un sello de tiempo: los JSON de
		// 23J no traen hora de totalización porque ese escrutinio está cerrado.
		if (!fecha || !sello?.hora) return 'Esperando datos de la jornada';
		return `Actualizado: ${fecha} — ${sello.hora}h`;
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

<header class="ticker" class:cerrado={!ESCRUTINIO_ABIERTO}>
	<div class="masthead">
		<span class="wordmark">29N</span>

		<span class="stamp">
			<span class="stamp-dot"></span>
			En directo
		</span>

		<span class="fecha-actualizacion">{fechaActualizacion}</span>

		<span class="logo-badge">
			<img class="logo" src={logo} alt="Newtral" />
		</span>
	</div>

	<!-- La fila del escrutinio desaparece entera mientras el panel está cerrado:
	     antes se quedaba con el sello "En directo" dentro y, al subirlo al
	     cabecero, habría quedado una franja vacía. -->
	{#if ESCRUTINIO_ABIERTO}
		<div class="row">
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
		</div>
	{/if}
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
		align-items: center;
		gap: 8px;
		padding: 7px 20px 0;
		min-width: 0;
	}

	/* Sin la fila del escrutinio debajo, el cabecero se queda pegado al ticker:
	   esa fila era la que ponía el aire. Se devuelve aquí en vez de dárselo
	   siempre al cabecero, que con el panel abierto lo separaría de más. */
	.ticker.cerrado .masthead {
		padding-bottom: 8px;
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.fecha-actualizacion {
		/* Que se recorte la fecha antes que empujar al logo fuera de la fila. */
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: 12px;
		font-style: italic;
		color: rgba(10, 14, 20, 0.5);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 7px 20px 4px;
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
		/* En la línea del cabecero, no centrado sobre todo el faldón: al acortar
		   el rótulo a "29N" quedó sitio de sobra ahí arriba. `margin-left:auto`
		   lo empuja al borde derecho sin posicionamiento absoluto, así que la
		   fila se reajusta sola en móvil en vez de solaparse con la fecha. */
		margin-left: auto;
		display: flex;
		align-items: center;
		flex: none;
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
