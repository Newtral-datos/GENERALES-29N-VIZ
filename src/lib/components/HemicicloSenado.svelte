<script lang="ts">
	import { CONVOCATORIA } from '#lib/config';
	import { getResultadosSenado, type NacionalSenado } from '#lib/data';
	import { ordenCamara } from '#lib/orden-camara';

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
	// La escala son los 208 de ELECCIÓN DIRECTA, que es lo que se decide en las
	// urnas. Los 58 designados por los parlamentos autonómicos no se dibujan:
	// llegan semanas después, cada parlamento con sus plazos, y su número
	// depende de la población (57 o 58 según la legislatura). Se explican en la
	// nota al pie. La marca señala la MITAD DE LOS ELECTOS (105 de 208), que es
	// el umbral propio de esta escala y por eso cae justo en la vertical del
	// hemiciclo. La mayoría absoluta del Senado (134 sobre los 266 de la Cámara
	// completa) no se dibuja: sobre una escala de 208 caería en el 64 % y
	// marcar dos umbrales distintos en el mismo gráfico confunde más que ayuda.

	const cx = 200;
	const cy = 206;

	// Geometría: 6 filas concéntricas entre r=110 y r=180 (el radio exterior es
	// el mismo que el del hemiciclo del Congreso, para que las dos cámaras se
	// vean del mismo tamaño). Con 208 celdas, el paso de 14px da cuadrados de
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

		const secuencia: Omit<Grupo, 'celdas'>[] = ordenCamara(
			nacional.partidos,
			(p) => p.escanos
		).map((p) => ({
			clave: p.siglas,
			siglas: p.siglas,
			nombre: p.nombre,
			color: p.color,
			escanos: p.escanos
		}));

		// Siempre las 208 celdas de la cámara que se elige, no las adjudicadas:
		// así los cuadrados no cambian de tamaño según avanza el escrutinio y
		// las que todavía no tienen dueño se ven vacías, que es el dato.
		const celdas = construirCeldas(electos);
		let i = 0;
		return secuencia.map((g) => {
			const suyas = celdas.slice(i, i + g.escanos);
			i += g.escanos;
			return { ...g, celdas: suyas };
		});
	});

	// Escala del gráfico: los 208 que se eligen en las urnas (ver AGENTS.md,
	// "Senado"), no los ya adjudicados. `totalEscanos` crece de 0 a 208 durante
	// la noche: usarlo dejaba la cámara siempre "completa" y, con 0, dividía
	// por cero.
	let electos = $derived(
		nacional ? nacional.totalEscanosCamara - nacional.escanosDesignadosPendientes : 0
	);

	// Las celdas que todavía no tiene nadie. Durante la noche son el dato que
	// falta —cuántos escaños quedan por decidir—, así que se dibujan vacías en
	// vez de no dibujarse: una cámara a medio llenar se lee de un vistazo, un
	// lienzo en blanco parece un error de carga.
	let celdasLibres = $derived.by(() => {
		const todas = construirCeldas(electos);
		const asignadas = grupos.reduce((n, g) => n + g.celdas.length, 0);
		return todas.slice(asignadas);
	});

	let mitadElectos = $derived(electos ? Math.floor(electos / 2) + 1 : 0);
	let angMayoria = $derived(electos ? 180 - (mitadElectos / electos) * 180 : 90);
	let mayInicio = $derived(polar(R_INT - 9, angMayoria));
	let mayFin = $derived(polar(R_EXT + 11, angMayoria));
	let mayEtiqueta = $derived(polar(R_EXT + 22, angMayoria));

	// Cifra protagonista: la fuerza más votada frente a la mayoría absoluta, que
	// es la lectura real de esta cámara.
	//
	// `reduce` sin valor inicial revienta con un array vacío ("Reduce of empty
	// array with no initial value"), y `partidos` está vacío durante toda la
	// fase previa al escrutinio: antes de las 20:00 del 29N, y durante el
	// simulacro entero. Eso tumbaba la vista del Senado con un 500, no la
	// dejaba a medias. Sin escrutinio no hay líder: es `null`, y la vista lo
	// trata como "sin datos".
	let lider = $derived(
		nacional && nacional.partidos.length
			? nacional.partidos.reduce((a, b) => (b.escanos > a.escanos ? b : a))
			: null
	);

	let sinEscrutinio = $derived(!!nacional && nacional.partidos.length === 0);

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
				<!-- El viewBox arranca en y=-24 para dejar hueco a la etiqueta del
				     umbral: al caer en el 50 % la marca queda vertical, justo en lo
				     alto del arco, y con el origen en 0 el texto se salía del lienzo.
				     Se gana aire arriba sin dejar espacio muerto abajo. -->
				<svg viewBox="0 -24 400 272" class="hemiciclo">
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
					<!-- Las dos líneas se apilan hacia ARRIBA del punto del marcador: puestas
					     debajo caían justo sobre él y el texto se comía el extremo de la línea. -->
					<text
						x={mayEtiqueta.x}
						y={mayEtiqueta.y - 10}
						text-anchor="middle"
						class="may-label"
					>
						Mitad de los electos
					</text>
					<text x={mayEtiqueta.x} y={mayEtiqueta.y} text-anchor="middle" class="may-label-sm">
						{mitadElectos} de {electos}
					</text>

					{#if lider}
						<text x={cx} y={cy - 54} text-anchor="middle" class="centro-siglas">{lider.siglas}</text>
						<text x={cx} y={cy - 18} text-anchor="middle" class="centro-numero">{lider.escanos}</text>
						<text x={cx} y={cy - 2} text-anchor="middle" class="centro-label">
							de {nacional.totalEscanos} electos
						</text>
					{:else if sinEscrutinio}
						<!-- La cámara dibujada y vacía dice la verdad del momento: hay
						     208 escaños que repartir y todavía no se ha repartido
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
						<span class="popup-name">{activo.nombre}</span>
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
					eligen en las urnas ({CONVOCATORIA}); la marca central es la mitad de esos escaños ({mitadElectos}).
					A ellos se suman después {nacional.escanosDesignadosPendientes} designados por los
					parlamentos autonómicos, hasta los {nacional.totalEscanosCamara} de la Cámara completa:
					la <b>mayoría absoluta del Senado son {nacional.mayoria} escaños</b>, que se cuentan sobre
					ese total y no sobre los electos.
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

	/* Filete neutro en todas las celdas. No es decoración: con 8px de lado, los
	   colores claros del catálogo (EH Bildu #A4CE4E y ERC #FFB400 quedan en
	   1.7:1 contra el papel, por debajo del 3:1 que pide la guía de dataviz) se
	   perderían sobre fondo blanco. El filete da el borde sin tocar el color
	   del partido, que no es nuestro para cambiarlo. */
	.celda {
		stroke: rgba(10, 14, 20, 0.28);
		stroke-width: 0.6;
	}

	.may-label {
		fill: var(--ink);
		font-family: var(--font-display);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.may-label-sm {
		fill: var(--grey);
		font-family: var(--font-body);
		font-size: 8px;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.centro-siglas {
		fill: var(--grey);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
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
