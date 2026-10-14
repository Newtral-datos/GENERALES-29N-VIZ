<script lang="ts">
	// TODO: sustituir por el % de escrutinio real cuando haya datos en vivo de la jornada.
	const ESCRUTINIO_SIMULADO = 92.3;

	let escrutinio = $state(0);

	$effect(() => {
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
		<span class="wordmark-sep"></span>
		<span class="wordmark-sub">Congreso de los Diputados</span>
	</div>

	<div class="row">
		<span class="stamp">
			<span class="stamp-dot"></span>
			En directo
		</span>

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
	</div>
</header>

<style>
	.ticker {
		background: var(--header-bg);
		color: #fff;
		position: sticky;
		top: 0;
		z-index: 50;
		width: 100%;
		border-bottom: 2px solid var(--c);
	}

	.masthead {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 10px 24px 0;
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.wordmark-sep {
		width: 14px;
		height: 1px;
		background: rgba(255, 255, 255, 0.3);
	}

	.wordmark-sub {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.55);
		font-style: italic;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 10px 24px 16px;
	}

	.stamp {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 7px;
		border: 1px solid var(--stamp);
		color: var(--stamp);
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.stamp-dot {
		width: 5px;
		height: 5px;
		background: var(--stamp);
		flex-shrink: 0;
	}

	.label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.5);
		flex-shrink: 0;
	}

	.number {
		font-family: var(--font-mono);
		font-size: 30px;
		font-weight: 700;
		color: var(--c);
		letter-spacing: -0.01em;
		line-height: 1;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.number-unit {
		font-size: 16px;
		font-weight: 500;
		color: rgba(1, 243, 179, 0.6);
		margin-left: 1px;
	}

	.bar {
		flex: 1;
		position: relative;
		height: 10px;
		background: rgba(255, 255, 255, 0.14);
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
		background: var(--header-bg);
	}

	@media (max-width: 640px) {
		.masthead {
			padding: 10px 16px 0;
		}

		.wordmark-sub {
			display: none;
		}

		.row {
			padding: 10px 16px 14px;
			gap: 12px;
			flex-wrap: wrap;
		}

		.number {
			font-size: 26px;
		}

		.bar {
			order: 3;
			flex-basis: 100%;
			height: 10px;
		}
	}
</style>
