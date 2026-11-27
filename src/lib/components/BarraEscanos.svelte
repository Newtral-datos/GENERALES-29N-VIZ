<script lang="ts">
	import { getResultados, type Nacional } from '#lib/data';
	import { bloquesCamara } from '#lib/orden-camara';
	import { tintaSobre } from '#lib/color';

	let nacional = $state<Nacional | null>(null);

	$effect(() => {
		getResultados().then((d) => {
			nacional = d.nacional;
		});
	});

	/**
	 * Los dos bloques y el hueco de lo que falta por repartir, en el centro.
	 *
	 * Durante el escrutinio no están los 350 escaños asignados, y con una sola
	 * secuencia de izquierda a derecha el hueco quedaba **al final de la barra**:
	 * se leía como que la derecha había sacado menos, cuando lo que pasa es que
	 * aún no se ha contado. Cada bloque crece desde su borde hacia el centro y lo
	 * pendiente queda en medio, que es donde está el centro de la cámara.
	 *
	 * Al cerrar el escrutinio `huecoPct` es 0 y la barra queda idéntica a antes.
	 */
	let bloques = $derived.by(() => {
		if (!nacional) return { izquierda: [], derecha: [], huecoPct: 0 };
		const total = nacional.totalEscanos;
		const { izquierda, derecha } = bloquesCamara(nacional.partidos, (p) => p.escanos);
		const conPct = (ps: typeof izquierda) =>
			ps.map((p) => ({ ...p, pct: (p.escanos / total) * 100 }));
		const repartidos = [...izquierda, ...derecha].reduce((t, p) => t + p.escanos, 0);
		return {
			izquierda: conPct(izquierda),
			derecha: conPct(derecha),
			huecoPct: Math.max(0, ((total - repartidos) / total) * 100)
		};
	});

	// Para el popup y la leyenda, que no saben de bloques.
	let segments = $derived([...bloques.izquierda, ...bloques.derecha]);

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
			{#if segments.length === 0}
				<!-- Las 20:00 del 29N: la cámara existe pero no hay ni un escaño
				     repartido. Se dibuja la barra entera en gris con el rótulo
				     puesto, en vez de dejar un hueco blanco que parece un fallo de
				     carga. El gris es el mismo de "sin escrutar" de los mapas. -->
				<div class="seg seg-vacio">
					<span class="seg-label-vacio">Sin escaños repartidos todavía</span>
				</div>
			{/if}
			{#each bloques.izquierda as s (s.siglas)}
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
						<span class="seg-label" style="color:{tintaSobre(s.color)}">{s.escanos}</span>
					{/if}
				</div>
			{/each}

			<!-- Lo que falta por repartir, en el centro. Mismo rayado que la barra
			     entera cuando no hay ni un escaño: dice "pendiente", no "de nadie". -->
			{#if bloques.huecoPct > 0 && segments.length > 0}
				<div
					class="seg seg-pendiente"
					style="width:{bloques.huecoPct}%"
					role="img"
					aria-label="{Math.round((bloques.huecoPct / 100) * nacional.totalEscanos)} escaños sin repartir todavía"
				></div>
			{/if}

			{#each bloques.derecha as s (s.siglas)}
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
						<span class="seg-label" style="color:{tintaSobre(s.color)}">{s.escanos}</span>
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
		<!-- La sigla y no el nombre completo: el popup es una etiqueta de un trozo
			     de gráfico, no una ficha del partido, y "EUZKO ALDERDI
			     JELTZALEA-PARTIDO NACIONALISTA VASCO" ocupaba tres líneas para decir
			     EAJ-PNV. Las siglas son las que el lector acaba de ver en la leyenda,
			     en la tabla y en el mapa. -->
			<span class="popup-name">{activePartido.siglas}</span>
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
	}

	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		cursor: pointer;
	}

	/* Filete blanco entre segmentos, en vez del encuadre gris que llevaba la
	   barra arriba y abajo (26/11). El encuadre metía dos rayas que no
	   significaban nada y, al ser más oscuras que varios colores del catálogo,
	   pesaban más que el propio dato; lo que de verdad hay que separar es un
	   partido del siguiente, no la barra del papel.

	   Va como `box-shadow` interior y no como `border-left`: los anchos son
	   porcentajes calculados sobre los escaños, y un borde de verdad se sumaría
	   a cada uno, así que la barra dejaría de medir 100 % y los segmentos no
	   serían proporcionales. El filete no entra en el primero porque ahí no
	   separa nada: sería un recorte del borde izquierdo de la barra. */
	.seg:not(:first-child) {
		box-shadow: inset 1px 0 0 var(--paper);
	}

	/* El rayado de "pendiente", el mismo de la barra vacía: así el hueco del
	   centro y la barra sin escrutar hablan el mismo idioma. */
	.seg-pendiente {
		background: repeating-linear-gradient(
			45deg,
			#e9ebee,
			#e9ebee 5px,
			#e2e5e9 5px,
			#e2e5e9 10px
		);
	}

	.seg-vacio {
		width: 100%;
		background: repeating-linear-gradient(
			45deg,
			#e9ebee,
			#e9ebee 5px,
			#e2e5e9 5px,
			#e2e5e9 10px
		);
	}

	.seg-label-vacio {
		font-family: var(--font-body);
		font-size: 10px;
		font-style: italic;
		color: var(--grey);
		letter-spacing: 0.02em;
	}

	.seg-label {
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
		font-size: 9px;
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
		font-size: 12px;
	}

	/* La marca de mayoría, un punto más grande desde el 26/11. Es el único
	   elemento del gráfico que no es un partido y la referencia contra la que se
	   lee todo lo demás, así que con 1px de filete competía en peso con los
	   bordes de los segmentos. La altura se pasa de 26 a 34: 26 era exactamente
	   la altura de la barra, así que la raya acababa a ras y no se veía rebasar
	   por abajo — ahora sobresale 8px y se lee como una marca puesta encima. */
	.maj-line {
		width: 2px;
		height: 34px;
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
