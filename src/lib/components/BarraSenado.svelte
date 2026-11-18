<script lang="ts">
	import { CONVOCATORIA, CONVOCATORIA_ANTERIOR } from '#lib/config';
	import { getResultadosSenado, type NacionalSenado } from '#lib/data';

	let nacional = $state<NacionalSenado | null>(null);

	$effect(() => {
		getResultadosSenado().then((d) => {
			nacional = d.nacional;
		});
	});

	// La barra se escala sobre los 208 senadores de ELECCIÓN DIRECTA, que es lo
	// que se decide en las urnas y lo único que el panel puede contar la noche
	// electoral. Los 58 designados por los parlamentos autonómicos no ocupan
	// tramo: llegan semanas después, cada parlamento con sus plazos, y su número
	// depende de la población (han sido 57 y 58 en distintas legislaturas), así
	// que reservarles sitio en el gráfico daba una Cámara que todavía no existe.
	// Se mencionan en la nota al pie, no en la escala.
	//
	// La marca señala la MITAD DE LOS ELECTOS (105 de 208), que es el umbral que
	// corresponde a esta escala y por eso cae en el centro de la barra. No es la
	// mayoría absoluta del Senado: esa son 134 sobre los 266 de la Cámara
	// completa y, sobre una escala de 208, caería en el 64 % — se explica en la
	// nota al pie en vez de dibujarse, para no marcar dos umbrales distintos en
	// el mismo gráfico. Etiquetarla bien es lo que evita que se lea como si el
	// que pase de 105 ya controlase la Cámara.
	// Escala de la barra: los escaños que se ELIGEN en las urnas (208), no los
	// que llevan adjudicados. `totalEscanos` crece de 0 a 208 a lo largo de la
	// noche, así que usarlo de denominador dejaba la barra siempre llena: a las
	// 21:00, con 20 escaños repartidos, esos 20 ocupaban el ancho entero y
	// parecía la Cámara completa. Y con 0 adjudicados era una división por cero.
	let electos = $derived(
		nacional ? nacional.totalEscanosCamara - nacional.escanosDesignadosPendientes : 0
	);

	let sinEscrutinio = $derived(!!nacional && nacional.partidos.length === 0);

	let segmentsLeft = $derived.by(() => {
		if (!nacional) return [];
		return nacional.partidos
			.filter((p) => p.lado === 1)
			.sort((a, b) => b.escanos - a.escanos)
			.map((p) => ({ ...p, pct: electos ? (p.escanos / electos) * 100 : 0 }));
	});

	let segmentsRight = $derived.by(() => {
		if (!nacional) return [];
		return nacional.partidos
			.filter((p) => p.lado === 2)
			.sort((a, b) => a.escanos - b.escanos)
			.map((p) => ({ ...p, pct: electos ? (p.escanos / electos) * 100 : 0 }));
	});

	let segments = $derived([...segmentsLeft, ...segmentsRight]);

	/**
	 * Los senadores electos en la convocatoria anterior, a la misma escala.
	 *
	 * Es el equivalente del anillo "ant." del hemiciclo del Congreso, que el
	 * Senado no tenía: su bloque `anterior` traía solo totales. Ahora el
	 * pipeline emite también el reparto por partido (`anterior.partidos`), que
	 * sale del fichero `ANT` del Ministerio.
	 *
	 * Solo escaños: ese fichero no trae votos ni candidatos, así que la
	 * comparativa de esta cámara no puede ser de otra cosa.
	 *
	 * Misma base de 208 que la barra de arriba, para que las dos se puedan
	 * comparar a ojo: si cada una se escalara a su propio total, un partido con
	 * los mismos escaños saldría de distinto ancho.
	 */
	let segmentosAnterior = $derived.by(() => {
		const previo = nacional?.anterior?.partidos ?? [];
		if (!previo.length || !electos) return [];
		const izq = previo.filter((p) => p.lado !== 2).sort((a, b) => b.escanos - a.escanos);
		const der = previo.filter((p) => p.lado === 2).sort((a, b) => a.escanos - b.escanos);
		return [...izq, ...der].map((p) => ({ ...p, pct: (p.escanos / electos) * 100 }));
	});

	let mitadElectos = $derived(electos ? Math.floor(electos / 2) + 1 : 0);
	let mayoriaPct = $derived(electos ? (mitadElectos / electos) * 100 : 50);

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
			{#each segmentsLeft as s (s.siglas)}
				<div
					class="seg"
					style="width:{s.pct}%; background:{s.color}"
					role="img"
					aria-label="{s.nombre}: {s.escanos} senadores"
					onmouseenter={(e) => onSegEnter(e, s.siglas)}
					onmousemove={onSegMove}
					onmouseleave={onSegLeave}
				>
					{#if s.pct >= 4}
						<span class="seg-label">{s.escanos}</span>
					{/if}
				</div>
			{/each}
			{#each segmentsRight as s (s.siglas)}
				<div
					class="seg"
					style="width:{s.pct}%; background:{s.color}"
					role="img"
					aria-label="{s.nombre}: {s.escanos} senadores"
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
			<span class="maj-text">Mitad de los electos<br /><b>{mitadElectos}</b></span>
			<span class="maj-line"></span>
		</div>
	</div>
	{#if segmentosAnterior.length}
		<div class="fila-anterior">
			<span class="etiqueta-anterior">{CONVOCATORIA_ANTERIOR}</span>
			<div class="barra-anterior">
				{#each segmentosAnterior as s (s.siglas)}
					<div
						class="seg-anterior"
						style="width:{s.pct}%; background:{s.color}"
						role="img"
						aria-label="{s.nombre}: {s.escanos} senadores en la elección anterior"
					></div>
				{/each}
			</div>
		</div>
	{/if}

	<p class="nota">
		Los {electos} senadores de elección directa — {CONVOCATORIA}; la marca central es la mitad de
		esos escaños ({mitadElectos}). A ellos se suman después {nacional.escanosDesignadosPendientes}
		designados por los parlamentos autonómicos, hasta los {nacional.totalEscanosCamara} de la Cámara
		completa: la <b>mayoría absoluta del Senado son {nacional.mayoria} escaños</b>, que se cuentan
		sobre ese total y no sobre los electos.
	</p>
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
		/* Tiene que igualar el alto de .maj-text (2 líneas, 8px + 10px a
		   line-height 1.1 ≈ 19.8px) más sus 6px de margen inferior: la línea
		   vertical del marcador se apila justo debajo del texto, así que si aquí
		   falta espacio el texto baja y pisa la barra. */
		padding-top: 26px;
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
		cursor: pointer;
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

	.fila-anterior {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
	}

	.etiqueta-anterior {
		flex: none;
		width: 26px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #9ca3af;
		text-align: right;
	}

	.barra-anterior {
		display: flex;
		flex: 1;
		/* Más baja y apagada que la barra principal: es la referencia, no el
		   dato de la noche. Mismo papel que el anillo interior del hemiciclo
		   del Congreso. */
		height: 8px;
		opacity: 0.55;
		min-width: 0;
	}

	.seg-anterior {
		height: 100%;
	}

	.nota {
		font-size: 9px;
		color: var(--grey);
		font-family: var(--font-body);
		font-style: italic;
		margin: 6px 0 0 0;
		text-align: center;
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
		box-shadow: var(--shadow-hard);
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
