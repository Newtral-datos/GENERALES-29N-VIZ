<script lang="ts">
	import { getResultados23j, type Nacional } from '#lib/data';

	let nacional = $state<Nacional | null>(null);

	$effect(() => {
		getResultados23j().then((d) => {
			nacional = d.nacional;
		});
	});

	let segments = $derived.by(() => {
		if (!nacional) return [];
		const left = nacional.partidos.filter((p) => p.lado === 1).sort((a, b) => b.escanos - a.escanos);
		const right = nacional.partidos.filter((p) => p.lado === 2).sort((a, b) => a.escanos - b.escanos);
		return [...left, ...right].map((p) => ({ ...p, pct: (p.escanos / nacional!.totalEscanos) * 100 }));
	});

	let mayoriaPct = $derived(nacional ? (nacional.mayoria / nacional.totalEscanos) * 100 : 0);

	let activeSiglas = $state<string | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	const POPUP_W = 140;

	function setPopupPos(x: number, y: number) {
		popupPos = {
			x: Math.min(Math.max(x + 12, 8), window.innerWidth - POPUP_W - 8),
			y: y + 16
		};
	}

	function onSegEnter(e: MouseEvent, siglas: string) {
		activeSiglas = siglas;
		setPopupPos(e.clientX, e.clientY);
	}

	function onSegMove(e: MouseEvent) {
		setPopupPos(e.clientX, e.clientY);
	}

	function onSegLeave() {
		activeSiglas = null;
	}

	let activePartido = $derived(
		activeSiglas ? (segments.find((s) => s.siglas === activeSiglas) ?? null) : null
	);
</script>

{#if !nacional}
	<p class="loading">Cargando datos…</p>
{:else}
	<div class="barra-wrap">
		<div class="barra">
			{#each segments as s (s.siglas)}
				<div
					class="seg"
					style="width:{s.pct}%; background:{s.color}"
					role="img"
					aria-label="{s.nombre}: {s.escanos} escaños"
					onmouseenter={(e) => onSegEnter(e, s.siglas)}
					onmousemove={onSegMove}
					onmouseleave={onSegLeave}
				>
					{#if s.pct >= 4}
						<span class="seg-label">{s.escanos}</span>
					{/if}
				</div>
			{/each}
		</div>
		<div class="maj-marker" style="left:{mayoriaPct}%">
			<span class="maj-text">Mayoría<br /><b>{nacional.mayoria}</b></span>
			<span class="maj-line"></span>
		</div>
	</div>
{/if}

{#if activePartido}
	<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
		<span class="popup-swatch" style="background:{activePartido.color}"></span>
		<span class="popup-name">{activePartido.nombre}</span>
	</div>
{/if}

<style>
	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 16px 0;
		text-align: center;
	}

	.barra-wrap {
		position: relative;
		padding-top: 22px;
	}

	.barra {
		display: flex;
		width: 100%;
		height: 26px;
		overflow: hidden;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		border-right: 1px solid var(--border);
		cursor: pointer;
	}
	.seg:last-child {
		border-right: none;
	}

	.seg-label {
		color: #fff;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.maj-marker {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.maj-text {
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--ink);
		text-align: center;
		line-height: 1.1;
		margin-bottom: 6px;
	}

	.maj-text b {
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.maj-line {
		width: 1px;
		height: 26px;
		background: var(--ink);
	}

	.popup {
		position: fixed;
		z-index: 60;
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--paper);
		border: 1px solid var(--ink);
		padding: 6px 10px;
		box-shadow: 2px 2px 0 rgba(10, 14, 20, 0.15);
		pointer-events: none;
	}

	.popup-swatch {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
	}

	.popup-name {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
	}
</style>
