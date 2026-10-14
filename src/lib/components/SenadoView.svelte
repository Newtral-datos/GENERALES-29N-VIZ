<main class="main">
	<div class="placeholder">
		<p class="kicker">Senado</p>
		<p class="note">Pendiente — se construirá cuando empiecen a llegar datos del Senado.</p>
	</div>
</main>

<style>
	.main {
		padding: 32px 24px;
	}

	.placeholder {
		padding: 60px 0;
		text-align: center;
	}

	.kicker {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 10px 0;
	}

	.note {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 0;
	}

	@media (max-width: 640px) {
		.main {
			padding: 16px;
		}
	}
</style>
