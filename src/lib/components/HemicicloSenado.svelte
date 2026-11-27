<script lang="ts">
	import { CONVOCATORIA } from '#lib/config';
	import { getResultadosSenado, type NacionalSenado } from '#lib/data';
	import { bloquesCamara } from '#lib/orden-camara';

	let nacional = $state<NacionalSenado | null>(null);

	$effect(() => {
		getResultadosSenado().then((d) => {
			nacional = d.nacional;
		});
	});

	// Un cuadrado = un senador. A diferencia del hemiciclo del Congreso (arcos
	// continuos por partido), aquí cada escaño es su propia celda, porque en el
	// Senado la unidad que de verdad importa es el senador individual: se elige
	// por voto limitado, candidato a candidato, no por reparto proporcional de
	// una lista.
	//
	// La escala son los 209 de ELECCIÓN DIRECTA, que es lo que se decide en las
	// urnas y lo único que el panel publica. Los designados por los parlamentos
	// autonómicos no se dibujan ni se cuentan: llegan semanas después y su
	// número no está confirmado (ver `senado_29n.py`, sobre ESCANOS_DIRECTOS).
	//
	// La marca señala la MITAD DE LOS ELECTOS (105 de 209), que es el umbral
	// propio de esta escala y por eso cae justo en la vertical del hemiciclo.
	// **No es la mayoría absoluta del Senado**, que se cuenta sobre la Cámara
	// completa: por eso se rotula "mitad de los electos" y la palabra "mayoría"
	// no aparece en esta pieza.

	const cx = 200;
	const cy = 206;

	// Geometría: 6 filas concéntricas entre r=110 y r=180 (el radio exterior es
	// el mismo que el del hemiciclo del Congreso, para que las dos cámaras se
	// vean del mismo tamaño). Con 209 celdas, el paso de 14px da cuadrados de
	// 10px con ~3px de aire tangencial y 4px entre filas — por encima del hueco
	// mínimo entre marcas que pide la guía de dataviz, y con la celda lo más
	// grande posible, que es lo que hace legible un cuadrado de este tamaño.
	const FILAS = 6;
	const R_EXT = 180;
	const PASO = 14;
	const CELDA = 10;

	const radios = Array.from({ length: FILAS }, (_, i) => R_EXT - i * PASO);
	const R_INT = radios[radios.length - 1];

	const deg2rad = (d: number) => (d * Math.PI) / 180;
	const polar = (r: number, a: number) => ({
		x: cx + r * Math.cos(deg2rad(a)),
		y: cy - r * Math.sin(deg2rad(a))
	});

	/**
	 * Reparte `total` celdas entre las filas en proporción a su radio (una fila
	 * exterior es más larga y le caben más), cuadrando el resto por el método
	 * del resto mayor para que la suma sea exactamente `total` — si sobra o
	 * falta una celda, el recuento de la cámara deja de cuadrar y se nota.
	 */
	function celdasPorFila(total: number) {
		const suma = radios.reduce((a, r) => a + r, 0);
		const exactos = radios.map((r) => (total * r) / suma);
		const base = exactos.map(Math.floor);
		let resto = total - base.reduce((a, n) => a + n, 0);
		const orden = exactos
			.map((v, i) => ({ i, frac: v - Math.floor(v) }))
			.sort((a, b) => b.frac - a.frac);
		for (let k = 0; k < resto; k++) base[orden[k % orden.length].i]++;
		return base;
	}

	type Celda = { x: number; y: number; ang: number };

	/** Todas las celdas del semicírculo, ordenadas de izquierda (180°) a derecha (0°). */
	function construirCeldas(total: number): Celda[] {
		const porFila = celdasPorFila(total);
		const celdas: Celda[] = [];
		radios.forEach((r, fila) => {
			const n = porFila[fila];
			const paso = 180 / n;
			for (let j = 0; j < n; j++) {
				const ang = 180 - (j + 0.5) * paso;
				const { x, y } = polar(r, ang);
				celdas.push({ x, y, ang });
			}
		});
		return celdas.sort((a, b) => b.ang - a.ang);
	}

	type Grupo = {
		clave: string;
		siglas: string;
		nombre: string;
		color: string;
		escanos: number;
		celdas: Celda[];
	};

	// Orden del hemiciclo: izquierda (lado 1) de mayor a menor, luego derecha
	// (lado 2) de menor a mayor — el mismo criterio que el del Congreso, para
	// que las dos cámaras se lean igual.
	let grupos = $derived.by<Grupo[]>(() => {
		if (!nacional) return [];

		type Fuerza = { siglas: string; nombre: string; color: string; escanos: number };
		const ficha = (p: Fuerza) => ({
			clave: p.siglas,
			siglas: p.siglas,
			nombre: p.nombre,
			color: p.color,
			escanos: p.escanos
		});
		const { izquierda, derecha } = bloquesCamara(nacional.partidos, (p) => p.escanos);

		// Siempre las 209 celdas de la cámara que se elige, no las adjudicadas:
		// así los cuadrados no cambian de tamaño según avanza el escrutinio y
		// las que todavía no tienen dueño se ven vacías, que es el dato.
		const celdas = construirCeldas(electos);

		// **Cada bloque desde su borde.** La izquierda ocupa celdas desde la
		// primera; la derecha, las últimas, así que las libres quedan en el
		// centro. Antes se repartían todas en secuencia desde la primera celda y
		// los huecos acababan amontonados en el borde derecho: parecía que la
		// derecha tenía menos senadores, cuando lo que faltaba era contar.
		const sumaDer = derecha.reduce((t, p) => t + p.escanos, 0);
		let i = 0;
		const gruposIzq = izquierda.map((p) => {
			const g = ficha(p);
			const suyas = celdas.slice(i, i + g.escanos);
			i += g.escanos;
			return { ...g, celdas: suyas };
		});
		let j = Math.max(i, electos - sumaDer);
		const gruposDer = derecha.map((p) => {
			const g = ficha(p);
			const suyas = celdas.slice(j, j + g.escanos);
			j += g.escanos;
			return { ...g, celdas: suyas };
		});
		return [...gruposIzq, ...gruposDer];
	});

	// Escala del gráfico: los 209 que se eligen en las urnas (ver AGENTS.md,
	// "Senado"), no los ya adjudicados. `totalEscanos` crece de 0 a 209 durante
	// la noche: usarlo dejaba la cámara siempre "completa" y, con 0, dividía
	// por cero.
	let electos = $derived(nacional?.electosTotales ?? 0);

	// Las celdas que todavía no tiene nadie. Durante la noche son el dato que
	// falta —cuántos escaños quedan por decidir—, así que se dibujan vacías en
	// vez de no dibujarse: una cámara a medio llenar se lee de un vistazo, un
	// lienzo en blanco parece un error de carga.
	let celdasLibres = $derived.by(() => {
		const todas = construirCeldas(electos);
		// Las libres son las del centro: las que no se ha llevado ningún grupo.
		// Se calcula por diferencia de conjuntos y no con un `slice`, porque los
		// dos bloques ocupan los dos extremos y el hueco está en medio.
		const ocupadas = new Set(grupos.flatMap((g) => g.celdas));
		return todas.filter((c) => !ocupadas.has(c));
	});

	// Del JSON, no recalculado: el umbral se decide en un solo sitio.
	let mitadElectos = $derived(nacional?.mitadElectos ?? 0);
	let angMayoria = $derived(electos ? 180 - (mitadElectos / electos) * 180 : 90);
	let mayInicio = $derived(polar(R_INT - 9, angMayoria));
	let mayFin = $derived(polar(R_EXT + 11, angMayoria));

	// `partidos` está vacío durante toda la fase previa al escrutinio: antes de
	// las 20:00 del 29N y durante el simulacro entero. El centro del hemiciclo
	// distingue los dos estados (umbral de mayoría / "sin escrutar"), así que
	// hace falta tenerlo declarado y no leer `.length` en la plantilla.
	let sinEscrutinio = $derived(!!nacional && nacional.partidos.length === 0);
	let conEscrutinio = $derived(!!nacional && nacional.partidos.length > 0);

	let activo = $state<Grupo | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	const POPUP_W = 230;

	function colocarPopup(x: number, y: number) {
		popupPos = {
			x: Math.min(Math.max(x + 12, 8), window.innerWidth - POPUP_W - 8),
			y: y + 16
		};
	}

	function onEnter(e: MouseEvent, g: Grupo) {
		activo = g;
		colocarPopup(e.clientX, e.clientY);
	}

	function onMove(e: MouseEvent) {
		colocarPopup(e.clientX, e.clientY);
	}

	function onLeave() {
		activo = null;
	}
</script>

<div class="panel">
	<p class="kicker">Composición de la Cámara</p>

	<div class="panel-body">
		{#if !nacional}
			<p class="loading">Cargando datos…</p>
		{:else}
			<div class="wrap">
				<!-- El viewBox arrancaba en y=-24 para dejar hueco a la etiqueta del
				     umbral, que caía justo en lo alto del arco y se salía del lienzo.
				     Al mover ese rótulo al centro (27/11) esas 24 unidades se
				     quedaban como aire muerto, encogiendo el dibujo sin motivo: lo
				     más alto que hay ahora es el extremo de la raya del umbral, en
				     y≈15 con el marcador vertical. -->
				<svg viewBox="0 0 400 248" class="hemiciclo">
					{#each celdasLibres as c, i (i)}
						<rect
							x={c.x - CELDA / 2}
							y={c.y - CELDA / 2}
							width={CELDA}
							height={CELDA}
							class="celda-libre"
							transform="rotate({-c.ang} {c.x} {c.y})"
						/>
					{/each}

					{#each grupos as g (g.clave)}
						<!-- Un <g> por partido, no por celda: el lector no quiere saber de un
						     senador anónimo, quiere el partido y su total, y así el área
						     sensible al ratón es toda la cuña en vez de un cuadrado de 8px.
						     role="img" en el grupo deja las celdas fuera del árbol accesible. -->
						<g
							class="grupo"
							class:apagado={activo !== null && activo.clave !== g.clave}
							role="img"
							aria-label={`${g.nombre}: ${g.escanos} ${g.escanos === 1 ? 'senador' : 'senadores'}`}
							onmouseenter={(e) => onEnter(e, g)}
							onmousemove={onMove}
							onmouseleave={onLeave}
						>
							{#each g.celdas as c, i (i)}
								<rect
									x={c.x - CELDA / 2}
									y={c.y - CELDA / 2}
									width={CELDA}
									height={CELDA}
									fill={g.color}
									transform="rotate({-c.ang} {c.x} {c.y})"
									class="celda"
								/>
							{/each}
						</g>
					{/each}

					<line
						x1={mayInicio.x}
						y1={mayInicio.y}
						x2={mayFin.x}
						y2={mayFin.y}
						stroke="var(--ink)"
						stroke-width="1.5"
					/>
					<circle cx={mayFin.x} cy={mayFin.y} r="2" fill="var(--ink)" />

					<!-- **El umbral se rotula en el centro, no sobre el arco** (27/11).
					     La raya y su punto se quedan, que son los que sitúan la mitad de
					     los electos sobre las celdas; lo que se quitó es el rótulo que
					     llevaban encima, porque decía exactamente lo mismo que ahora dice
					     el centro y dos veces el mismo número se lee como dos umbrales
					     distintos. Es además la disposición del hemiciclo del Congreso:
					     una raya en su ángulo y el número grande en medio.

					     **Y es "mitad de los electos", no "mayoría".** La mayoría absoluta
					     del Senado se cuenta sobre la Cámara completa, que incluye a los
					     designados por los parlamentos autonómicos, y ese número no se
					     publica porque no está confirmado (razonamiento en
					     `senado_29n.py`, sobre ESCANOS_DIRECTOS). Quien pase de 105 no
					     controla el Senado, y el rótulo es lo único que impide leerlo al
					     revés.

					     Lo que NO puede ir aquí es el más votado, que es lo que había
					     hace dos iteraciones: el centro de un hemiciclo no es el sitio de
					     "quién va primero" —eso lo dicen la tabla y la barra— y el
					     denominador acababa siendo una cifra que cambia con cada envío. -->
					{#if conEscrutinio}
						<text x={cx} y={cy - 46} text-anchor="middle" class="centro-label">
							Mitad de los electos
						</text>
						<text x={cx} y={cy - 12} text-anchor="middle" class="centro-numero">
							{mitadElectos}
						</text>
						<text x={cx} y={cy + 4} text-anchor="middle" class="centro-label">
							de {electos}
						</text>
					{:else if sinEscrutinio}
						<!-- La cámara dibujada y vacía dice la verdad del momento: hay
						     209 escaños que repartir y todavía no se ha repartido
						     ninguno. Mejor que un hueco en blanco, que parece un fallo. -->
						<text x={cx} y={cy - 26} text-anchor="middle" class="centro-vacio">Sin escrutar</text>
						<text x={cx} y={cy - 6} text-anchor="middle" class="centro-label">
							{electos} escaños en juego
						</text>
					{/if}

				</svg>

				{#if activo}
					<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
						<span class="popup-swatch" style="background:{activo.color}"></span>
						<!-- La sigla y no el nombre completo: el popup es una etiqueta de un trozo
			     de gráfico, no una ficha del partido, y "EUZKO ALDERDI
			     JELTZALEA-PARTIDO NACIONALISTA VASCO" ocupaba tres líneas para decir
			     EAJ-PNV. Las siglas son las que el lector acaba de ver en la leyenda,
			     en la tabla y en el mapa. -->
			<span class="popup-name">{activo.siglas}</span>
						<span class="popup-seats">
							{activo.escanos}
							{activo.escanos === 1 ? 'senador' : 'senadores'}
						</span>
					</div>
				{/if}

				<ul class="legend">
					{#each grupos as g (g.clave)}
						<li class="entry">
							<span class="swatch" style="background:{g.color}"></span>
							<span class="entry-name">{g.siglas}</span>
							<span class="entry-value">{g.escanos}</span>
						</li>
					{/each}
				</ul>

				<p class="nota">
					Cada cuadrado es un senador de elección directa — los {electos} que se
					eligen en las urnas ({CONVOCATORIA}); la marca del arco es la mitad de esos escaños
					({mitadElectos}). <b>No es la mayoría absoluta del Senado</b>: a estos se suman después
					los senadores que designan los parlamentos autonómicos, y la mayoría se cuenta sobre
					la Cámara completa.
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.panel {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.kicker {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		margin: 0 0 8px 0;
		text-align: center;
	}

	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 24px 0;
	}

	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
	}

	.hemiciclo {
		width: 100%;
		max-width: 420px;
	}

	.celda-libre {
		fill: #fff;
		stroke: #e5e7eb;
		stroke-width: 0.6;
	}

	.grupo {
		cursor: pointer;
	}

	/* El resaltado va por grupo: al apuntar a un partido, el resto baja de
	   opacidad en vez de que cambie la celda suelta bajo el cursor. */
	.grupo.apagado {
		opacity: 0.25;
	}

	/* Filete blanco en todas las celdas (26/11), por coherencia con la barra y el
	   hemiciclo del Congreso, que esa misma tarde dejaron el gris por el blanco.

	   **Y aquí tiene una contrapartida que conviene no perder de vista**, porque
	   es el motivo por el que el filete era gris: las celdas ya van separadas por
	   geometría (10px de lado con 14 de paso, o sea 4 de papel entre filas), así
	   que un filete blanco no separa nada que no estuviera separado — lo que hacía
	   el gris era dar borde a los colores claros del catálogo, que sobre papel
	   blanco se quedan en 1,7:1 (EH Bildu #A4CE4E, ERC #FFB400) cuando la guía de
	   dataviz pide 3:1. Sin él, un senador de EH Bildu y una celda libre se
	   distinguen solo por el tono del relleno. Volver atrás es cambiar este
	   `stroke` por `rgba(10, 14, 20, 0.28)`: no depende de nada más. */
	.celda {
		stroke: var(--paper);
		stroke-width: 0.6;
	}

	.centro-numero {
		fill: var(--ink);
		font-family: var(--font-mono);
		font-size: 34px;
		font-weight: 700;
	}

	.centro-vacio {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		fill: #9ca3af;
	}

	.centro-label {
		fill: var(--grey);
		font-family: var(--font-body);
		font-size: 9px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
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

	.popup-seats {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--grey);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 3px 12px;
		margin: 8px 0 0 0;
		padding: 0;
		list-style: none;
		width: 100%;
	}

	.entry {
		display: flex;
		align-items: baseline;
		gap: 5px;
	}

	.swatch {
		width: 6px;
		height: 6px;
		flex-shrink: 0;
		transform: translateY(1px);
	}

	.entry-name {
		font-family: var(--font-body);
		font-size: 10px;
		color: var(--grey);
	}

	.entry-value {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.nota {
		font-family: var(--font-body);
		font-size: 9px;
		line-height: 1.45;
		color: var(--grey);
		margin: 10px 0 0 0;
		max-width: 420px;
		text-align: center;
	}
</style>
