<script lang="ts">
	import logo from '#lib/assets/logo-newtral.png';
	import { ESCRUTINIO_ABIERTO } from '#lib/config';

	// TODO: sustituir por el % de escrutinio real cuando haya datos en vivo de la jornada.
	const ESCRUTINIO_SIMULADO = 92.3;

	let escrutinio = $state(0);

	$effect(() => {
		if (!ESCRUTINIO_ABIERTO) return;
		const steps = 30;
		const inc = ESCRUTINIO_SIMULADO / steps;
		let step = 0;
		const t = setInterval(() => {
			step++;
			escrutinio = Math.min(ESCRUTINIO_SIMULADO, inc * step);
			if (step >= steps) clearInterval(t);
		}, 1000 / steps);
		return () => clearInterval(t);
	});
</script>

<header class="ticker">
	<div class="masthead">
		<span class="wordmark">Generales 29N</span>
	</div>

	<div class="row">
		<span class="stamp">
			<span class="stamp-dot"></span>
			En directo
		</span>

		{#if ESCRUTINIO_ABIERTO}
			<span class="label">Escrutinio</span>

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
		border-bottom: 2px solid var(--c);
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

	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 7px 110px 10px 20px;
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
		font-size: 22px;
		font-weight: 700;
		color: var(--c);
		letter-spacing: -0.01em;
		line-height: 1;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.number-unit {
		font-size: 13px;
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
			padding: 8px 100px 10px 16px;
			gap: 10px;
			flex-wrap: wrap;
		}

		.number {
			font-size: 20px;
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
