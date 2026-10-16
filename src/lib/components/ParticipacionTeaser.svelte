<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<a href={resolve('/participacion')} class="teaser">
	<div class="teaser-text">
		<span class="eyebrow">Participación electoral</span>
		<span class="headline">¿Cuánta gente ha votado?</span>
		<span class="sub">Mapa y ranking de participación por provincia</span>
	</div>
	<div class="teaser-gauge">
		<svg viewBox="0 0 120 68" class="mini-gauge">
			<path d="M8,62 A52,52 0 0 1 112,62" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="13" stroke-linecap="round" />
			<path d="M8,62 A52,52 0 0 1 88,15" fill="none" stroke="var(--c)" stroke-width="13" stroke-linecap="round" />
		</svg>
		<span class="cta">Ver participación <span class="arrow">→</span></span>
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

	.teaser-gauge {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.mini-gauge {
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
		transition: box-shadow 0.15s ease, transform 0.15s ease;
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

		.teaser-gauge {
			align-self: center;
		}
	}
</style>
