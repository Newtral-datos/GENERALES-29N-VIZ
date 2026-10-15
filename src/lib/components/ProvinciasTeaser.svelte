<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<a href={resolve('/provincias')} class="teaser">
	<div class="teaser-text">
		<span class="eyebrow">Resultados por provincia</span>
		<span class="headline">¿Cómo votó tu provincia?</span>
		<span class="sub">Escaños, partidos más votados y reparto completo en cada provincia</span>
	</div>
	<div class="teaser-mapa">
		<svg viewBox="0 0 120 68" class="mini-mapa">
			<rect x="10" y="12" width="22" height="18" fill="#0557A1" />
			<rect x="34" y="8" width="18" height="14" fill="#E10819" />
			<rect x="54" y="18" width="20" height="22" fill="#0557A1" />
			<rect x="10" y="32" width="18" height="20" fill="#02C119" />
			<rect x="30" y="24" width="20" height="24" fill="#E10819" />
			<rect x="76" y="10" width="16" height="16" fill="#E10819" />
			<rect x="76" y="28" width="18" height="18" fill="#0557A1" />
			<rect x="52" y="44" width="22" height="16" fill="#0557A1" />
		</svg>
		<span class="cta">Ver resultados <span class="arrow">→</span></span>
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

	.teaser-mapa {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.mini-mapa {
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
			align-items: flex-start;
			padding: 22px 16px;
			gap: 18px;
		}

		.headline {
			font-size: 20px;
		}

		.teaser-mapa {
			align-self: center;
		}
	}
</style>
