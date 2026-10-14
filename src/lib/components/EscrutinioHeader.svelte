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

<header class="escrutinio-header">
	<div class="top-bar"></div>
	<div class="content">
		<p class="eyebrow">
			<span class="pulse-live live-dot"></span>
			Escrutinio en directo
			<span class="updated">— Actualizado: hace instantes</span>
		</p>
		<div class="row">
			<span class="number">{escrutinio.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%</span>
			<div class="bar">
				<div class="fill" style="width:{escrutinio}%">
					<div class="shimmer"></div>
				</div>
			</div>
		</div>
	</div>
</header>

<style>
	.escrutinio-header {
		background: #fff;
		border-bottom: 1px solid #e5e7eb;
		position: sticky;
		top: 0;
		z-index: 50;
		width: 100%;
	}

	.top-bar {
		height: 3px;
		background: linear-gradient(90deg, var(--c) 0%, var(--cd) 100%);
	}

	.content {
		padding: 14px 24px;
	}

	.eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--grey);
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		row-gap: 2px;
		gap: 6px;
		margin: 0 0 10px 0;
	}

	.live-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c);
	}

	.updated {
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		font-style: italic;
		font-size: 13px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.number {
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 40px;
		font-weight: 700;
		color: var(--c);
		letter-spacing: -0.03em;
		line-height: 1;
		flex-shrink: 0;
	}

	.bar {
		flex: 1;
		position: relative;
		height: 6px;
		border-radius: 3px;
		background: #f1f5f9;
		overflow: hidden;
	}

	.fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--c);
		border-radius: 3px;
		transition: width 1s ease-out;
	}

	.shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
		animation: shimmer 2.5s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% {
			transform: translateX(-200%);
		}
		100% {
			transform: translateX(200%);
		}
	}

	@media (max-width: 640px) {
		.content {
			padding: 12px 16px;
		}

		.number {
			font-size: 32px;
		}

		.row {
			gap: 12px;
		}
	}
</style>
