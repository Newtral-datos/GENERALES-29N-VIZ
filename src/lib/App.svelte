<script lang="ts">
	import EscrutinioHeader from '#lib/components/EscrutinioHeader.svelte';
	import BarraEscanos from '#lib/components/BarraEscanos.svelte';
	import Hemiciclo from '#lib/components/Hemiciclo.svelte';
</script>

<div class="page">
	<EscrutinioHeader />

	<main class="main">
		<div class="barra-section">
			<BarraEscanos />
		</div>

		<div class="grid">
			<div class="col-hemiciclo">
				<Hemiciclo />
			</div>
		</div>
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		background: #fff;
	}

	.main {
		padding: 24px;
	}

	.barra-section {
		margin-bottom: 20px;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 20px;
		min-width: 0;
	}

	.col-hemiciclo {
		max-width: 480px;
		min-width: 0;
	}

	@media (max-width: 640px) {
		.main {
			padding: 16px;
		}
	}
</style>
