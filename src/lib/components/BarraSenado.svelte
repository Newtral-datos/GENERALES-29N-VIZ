<script lang="ts">
	import { CONVOCATORIA, CONVOCATORIA_ANTERIOR } from '#lib/config';
	import { getResultadosSenado, type NacionalSenado } from '#lib/data';
	import { bloquesCamara, ordenCamara } from '#lib/orden-camara';
	import { tintaSobre } from '#lib/color';

	let nacional = $state<NacionalSenado | null>(null);

	$effect(() => {
		getResultadosSenado().then((d) => {
			nacional = d.nacional;
		});
	});

	// La barra se escala sobre los 209 senadores de ELECCIÓN DIRECTA, que es lo
	// que se decide en las urnas y lo único que el panel publica. `totalEscanos`
	// no vale de denominador: son los YA adjudicados y crece de 0 a 209 durante
	// la noche, así que a las 21:00, con 20 repartidos, esos 20 ocupaban el
	// ancho entero y parecía la cámara completa. Y con 0, división por cero.
	//
	// **Los designados por los parlamentos autonómicos no se publican** (ver
	// `senado_29n.py`): su número no está confirmado y afirmarlo arrastraría un
	// total de Cámara y una mayoría absoluta construidos sobre un supuesto.
	//
	// Por eso la marca señala la MITAD DE LOS ELECTOS (105 de 209) y se rotula
	// así, sin la palabra "mayoría" en ninguna parte: es el umbral que
	// corresponde a esta escala, cae en el centro de la barra, y es un hecho.
	// Quien pase de 105 NO controla el Senado, y el rótulo es lo único que lo
	// impide leer al revés.
	let electos = $derived(nacional?.electosTotales ?? 0);

	let sinEscrutinio = $derived(!!nacional && nacional.partidos.length === 0);

	// Mismo orden que el Congreso, del mismo módulo: lado del catálogo, grandes
	// hacia fuera y VOX fijado al borde derecho (ver #lib/orden-camara). Antes
	// era esta misma ordenación copiada aquí, así que las dos cámaras podían
	// acabar leyéndose distinto con solo tocar una.
	// Igual que la barra del Congreso: los dos bloques desde su borde y lo que
	// falta por escrutar en el centro. Con el hueco al final, el lado derecho
	// parecía haber sacado menos de lo que tiene.
	let bloques = $derived.by(() => {
		if (!nacional || !electos) return { izquierda: [], derecha: [], huecoPct: 0 };
		const { izquierda, derecha } = bloquesCamara(nacional.partidos, (p) => p.escanos);
		const conPct = (ps: typeof izquierda) =>
			ps.map((p) => ({ ...p, pct: (p.escanos / electos) * 100 }));
		const repartidos = [...izquierda, ...derecha].reduce((t, p) => t + p.escanos, 0);
		return {
			izquierda: conPct(izquierda),
			derecha: conPct(derecha),
			huecoPct: Math.max(0, ((electos - repartidos) / electos) * 100)
		};
	});

	let segments = $derived([...bloques.izquierda, ...bloques.derecha]);

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
	 * Misma base de 209 que la barra de arriba, para que las dos se puedan
	 * comparar a ojo: si cada una se escalara a su propio total, un partido con
	 * los mismos escaños saldría de distinto ancho.
	 */
	let segmentosAnterior = $derived.by(() => {
		const previo = nacional?.anterior?.partidos ?? [];
		if (!previo.length || !electos) return [];
		return ordenCamara(previo, (p) => p.escanos).map((p) => ({
			...p,
			pct: (p.escanos / electos) * 100
		}));
	});

	// Del JSON, no recalculado: el umbral se decide en un solo sitio (el
	// pipeline), que es el mismo criterio que el resto del panel.
	let mitadElectos = $derived(nacional?.mitadElectos ?? 0);
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
			{#each bloques.izquierda as s (s.siglas)}
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
						<span class="seg-label" style="color:{tintaSobre(s.color)}">{s.escanos}</span>
					{/if}
				</div>
			{/each}

			{#if bloques.huecoPct > 0 && segments.length > 0}
				<div
					class="seg seg-pendiente"
					style="width:{bloques.huecoPct}%"
					role="img"
					aria-label="{Math.round((bloques.huecoPct / 100) * electos)} senadores sin repartir todavía"
				></div>
			{/if}

			{#each bloques.derecha as s (s.siglas)}
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
						<span class="seg-label" style="color:{tintaSobre(s.color)}">{s.escanos}</span>
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
		esos escaños ({mitadElectos}). <b>No es la mayoría absoluta del Senado</b>: a estos se suman
		después los senadores que designan los parlamentos autonómicos, y la mayoría se cuenta sobre
		la Cámara completa.
	</p>
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
	}

	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		cursor: pointer;
	}

	/* Filete blanco entre segmentos, igual que la barra del Congreso (ver
	   BarraEscanos.svelte, donde está el razonamiento y el por qué va como
	   `box-shadow` y no como borde). Las dos barras tienen que separar los
	   partidos de la misma forma: son la misma pieza con otra cámara. */
	.seg:not(:first-child) {
		box-shadow: inset 1px 0 0 var(--paper);
	}

	/* El rayado de "pendiente", el mismo que la barra del Congreso. */
	.seg-pendiente {
		background: repeating-linear-gradient(
			45deg,
			#e9ebee,
			#e9ebee 5px,
			#e2e5e9 5px,
			#e2e5e9 10px
		);
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

	/* La barra de referencia separa igual que la de arriba. Con 8px de alto y al
	   55 % de opacidad el filete casi no se ve, y es lo que toca: tiene que
	   partir los tramos sin llamar la atención sobre el dato viejo. */
	.seg-anterior:not(:first-child) {
		box-shadow: inset 1px 0 0 var(--paper);
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
