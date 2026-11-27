<script lang="ts">
	import { getResultados, type Nacional } from '#lib/data';
	import { CONVOCATORIA, CONVOCATORIA_ANTERIOR } from '#lib/config';
	import { bloquesCamara } from '#lib/orden-camara';
	import { tintaSobre } from '#lib/color';

	let nacional = $state<Nacional | null>(null);

	$effect(() => {
		getResultados().then((d) => {
			nacional = d.nacional;
		});
	});

	const deg2rad = (d: number) => (d * Math.PI) / 180;
	const polar = (cx: number, cy: number, r: number, a: number) => ({
		x: cx + r * Math.cos(deg2rad(a)),
		y: cy - r * Math.sin(deg2rad(a))
	});

	const arcPath = (cx: number, cy: number, ri: number, ro: number, a0: number, a1: number) => {
		const os = polar(cx, cy, ro, a0);
		const oe = polar(cx, cy, ro, a1);
		const ie = polar(cx, cy, ri, a1);
		const is_ = polar(cx, cy, ri, a0);
		const la = Math.abs(a1 - a0) > 180 ? 1 : 0;
		const sw = a1 > a0 ? 0 : 1;
		return [
			'M', os.x, os.y,
			'A', ro, ro, 0, la, sw, oe.x, oe.y,
			'L', ie.x, ie.y,
			'A', ri, ri, 0, la, sw ? 0 : 1, is_.x, is_.y,
			'Z'
		].join(' ');
	};

	const cx = 200,
		cy = 200,
		oR = 180,
		iR = 132;

	// Anillo interior: composición real de la elección anterior (ver
	// nacional.anterior.partidos, roster propio e independiente del actual).
	const oR2 = 116,
		iR2 = 72;

	const buildSegments = <T extends { lado: number; nombre: string; siglas: string; color: string }>(
		items: T[],
		getSeats: (p: T) => number,
		total: number,
		ri: number,
		ro: number,
		prefix: string
	) => {
		/**
		 * Cada bloque arranca en **su** borde, no los dos en el izquierdo.
		 *
		 * Durante el escrutinio no están los 350 escaños repartidos. Con una sola
		 * secuencia, los arcos se iban apilando desde la izquierda y el hueco
		 * quedaba en el borde derecho: parecía que la derecha había sacado menos,
		 * cuando lo que pasaba es que faltaba contar. Así que la izquierda acumula
		 * desde 0 y la derecha se coloca para **acabar en el total**, dejando lo
		 * pendiente en el centro del hemiciclo.
		 *
		 * Con el escrutinio cerrado los dos bloques se tocan en el centro y el
		 * dibujo es el mismo de siempre.
		 */
		const { izquierda, derecha } = bloquesCamara(items, getSeats);
		const sumar = (ps: T[]) => ps.reduce((t, p) => t + getSeats(p), 0);
		const arcos: {
			p: T;
			seats: number;
			a0: number;
			a1: number;
		}[] = [];

		let acc = 0;
		for (const p of izquierda) {
			const seats = getSeats(p);
			arcos.push({ p, seats, a0: 180 - (acc / total) * 180, a1: 180 - ((acc + seats) / total) * 180 });
			acc += seats;
		}

		acc = total - sumar(derecha);
		for (const p of derecha) {
			const seats = getSeats(p);
			arcos.push({ p, seats, a0: 180 - (acc / total) * 180, a1: 180 - ((acc + seats) / total) * 180 });
			acc += seats;
		}

		return arcos.map(({ p, seats, a0, a1 }, i) => {
			const lp = polar(cx, cy, (ri + ro) / 2, (a0 + a1) / 2);
			return { ...p, seats, path: arcPath(cx, cy, ri, ro, a0, a1), lx: lp.x, ly: lp.y, key: `${prefix}${i}` };
		});
	};

	/**
	 * El arco de lo que falta por repartir, en el centro.
	 *
	 * Sin esto el hueco del centro se quedaba en blanco y seguía pareciendo un
	 * fallo de dibujo — solo cambiado de sitio. Gris liso y no el rayado de la
	 * barra: en SVG el rayado pide un `<pattern>` y aquí ya hay uno para los
	 * empates; un gris plano dice lo mismo sin añadir otra textura al dibujo.
	 */
	let pendiente = $derived.by(() => {
		if (!nacional) return null;
		const total = nacional.totalEscanos;
		const repartidos = nacional.partidos.reduce((t, p) => t + p.escanos, 0);
		if (repartidos <= 0 || repartidos >= total) return null;
		const { izquierda, derecha } = bloquesCamara(nacional.partidos, (p) => p.escanos);
		const sumaIzq = izquierda.reduce((t, p) => t + p.escanos, 0);
		const sumaDer = derecha.reduce((t, p) => t + p.escanos, 0);
		return {
			path: arcPath(cx, cy, iR, oR, 180 - (sumaIzq / total) * 180, 180 - ((total - sumaDer) / total) * 180),
			escanos: total - repartidos
		};
	});

	let majAngle = $derived(nacional ? 180 - (nacional.mayoria / nacional.totalEscanos) * 180 : 180);
	let majStart = $derived(polar(cx, cy, iR2 - 14, majAngle));
	let majEnd = $derived(polar(cx, cy, oR + 14, majAngle));

	let segments = $derived(
		nacional ? buildSegments(nacional.partidos, (p) => p.escanos, nacional.totalEscanos, iR, oR, 'cur') : []
	);
	let segmentsAnterior = $derived(
		nacional
			? buildSegments(nacional.anterior.partidos, (p) => p.escanos, nacional.anterior.totalEscanos, iR2, oR2, 'ant')
			: []
	);

	// La leyenda solo lleva a quien tiene escaño esta noche. La tabla nacional
	// incluye además marcas a cero —las que tuvieron representación en la
	// convocatoria anterior (PACMA, CCa, U.P.N.)— porque la columna "Dif." de
	// la tabla las necesita, pero en una leyenda de color son ruido: no pintan
	// ningún arco, así que su cuadradito no identifica nada en el dibujo.
	let leyenda = $derived(nacional ? nacional.partidos.filter((p) => p.escanos > 0) : []);

	// Mientras no haya ni un escaño repartido, el único anillo con contenido es
	// el de la convocatoria anterior (dato fijo, ver data.ts > respaldoCongreso),
	// así que la leyenda es la suya y lo dice. Sin esto el hemiciclo salía con
	// los dos arcos dibujados y ninguna referencia de color debajo.
	let sinJornada = $derived(leyenda.length === 0);
	let leyendaAnterior = $derived(nacional?.anterior?.partidos ?? []);

	type Segmento = { nombre: string; siglas: string; color: string; seats: number };

	let activeSeg = $state<Segmento | null>(null);
	let popupPos = $state({ x: 0, y: 0 });

	const POPUP_W = 160;

	function setPopupPos(x: number, y: number) {
		popupPos = {
			x: Math.min(Math.max(x + 12, 8), window.innerWidth - POPUP_W - 8),
			y: y + 16
		};
	}

	function onSegEnter(e: MouseEvent, s: Segmento) {
		activeSeg = s;
		setPopupPos(e.clientX, e.clientY);
	}

	function onSegMove(e: MouseEvent) {
		setPopupPos(e.clientX, e.clientY);
	}

	function onSegLeave() {
		activeSeg = null;
	}
</script>

<div class="panel">
	<p class="kicker">Distribución de escaños</p>

	<div class="panel-body">
	{#if !nacional}
	<p class="loading">Cargando datos…</p>
	{:else}
	<div class="wrap">
		<svg viewBox="0 0 400 240" class="hemiciclo">
			<defs>
				<pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
					<rect width="4" height="4" fill="transparent" />
					<line x1="0" y1="0" x2="0" y2="4" stroke="rgba(10,14,20,0.4)" stroke-width="1" />
				</pattern>
			</defs>

			<!-- Los dos arcos de contorno (uno por anillo) se quitaron el 26/11: el
			     filete gris encuadraba el dibujo entero y pesaba más que los
			     propios escaños, y lo que hay que separar es un partido del
			     siguiente. Eso lo hace ahora el filete blanco de `.seg-hover`.

			     El contorno no se sustituye por nada: con el escrutinio a cero no
			     queda un anillo vacío que marcar, porque ese caso ya lo cubren el
			     arco gris de `pendiente` (lo que falta por repartir) y el anillo de
			     la convocatoria anterior, que sí tiene contenido desde días antes. -->

			{#if pendiente}
				<path
					d={pendiente.path}
					fill="#e9ebee"
					role="img"
					aria-label="{pendiente.escanos} escaños sin repartir todavía"
				/>
			{/if}

			{#each segments as s (s.key)}
				<g>
					<path
						d={s.path}
						fill={s.color}
						class="seg-hover"
						role="img"
						aria-label="{s.nombre}: {s.seats} escaños"
						onmouseenter={(e) => onSegEnter(e, s)}
						onmousemove={onSegMove}
						onmouseleave={onSegLeave}
					/>
					{#if s.seats >= 10}
						<text x={s.lx} y={s.ly} text-anchor="middle" dominant-baseline="middle" class="seg-label" fill={tintaSobre(s.color)}>
							{s.seats}
						</text>
					{/if}
				</g>
			{/each}

			{#each segmentsAnterior as s (s.key)}
				<g opacity="0.55">
					<path
						d={s.path}
						fill={s.color}
						class="seg-hover"
						role="img"
						aria-label="{s.nombre}: {s.seats} escaños (elección anterior)"
						onmouseenter={(e) => onSegEnter(e, s)}
						onmousemove={onSegMove}
						onmouseleave={onSegLeave}
					/>
					<path d={s.path} fill="url(#hatch)" pointer-events="none" />
					{#if s.seats >= 15}
						<text x={s.lx} y={s.ly} text-anchor="middle" dominant-baseline="middle" class="seg-label-sm" fill={tintaSobre(s.color)}>
							{s.seats}
						</text>
					{/if}
				</g>
			{/each}

			<!-- Marca de mayoría, un punto más gruesa desde el 26/11 (1,5 -> 2,5 y
			     los topes de r=2 a r=3). Es la referencia contra la que se lee el
			     reparto entero y es el único trazo del dibujo que no es un partido:
			     con 1,5px pesaba lo mismo que la separación entre dos arcos. -->
			<line x1={majStart.x} y1={majStart.y} x2={majEnd.x} y2={majEnd.y} stroke="var(--ink)" stroke-width="2.5" />
			<circle cx={majStart.x} cy={majStart.y} r="3" fill="var(--ink)" />
			<circle cx={majEnd.x} cy={majEnd.y} r="3" fill="var(--ink)" />

			<text x={cx} y={cy - 18} text-anchor="middle" class="centre-label">Mayoría</text>
			<text x={cx} y={cy + 10} text-anchor="middle" class="centre-number">{nacional.mayoria}</text>
			<text x={cx} y={cy + 26} text-anchor="middle" class="centre-label">escaños</text>

			<!-- Qué convocatoria es cada anillo. Estaban escritos a mano: el exterior
			     decía "2023" (cierto cuando los datos de prueba eran los de 23J, falso
			     desde que el panel lee el 29N) y el interior un "ant." que no dice de
			     cuándo. Ahora salen de #lib/config, igual que las notas de los mapas. -->
			<text x={cx - oR + 16} y={cy + 20} text-anchor="middle" class="pole-label">{CONVOCATORIA}</text>
			<text x={cx + oR - 16} y={cy + 20} text-anchor="middle" class="pole-label">{CONVOCATORIA}</text>
			<text x={cx - oR2 + 14} y={cy + 16} text-anchor="middle" class="pole-label-sm">{CONVOCATORIA_ANTERIOR}</text>
			<text x={cx + oR2 - 14} y={cy + 16} text-anchor="middle" class="pole-label-sm">{CONVOCATORIA_ANTERIOR}</text>
		</svg>

		{#if activeSeg}
			<div class="popup" style="left:{popupPos.x}px; top:{popupPos.y}px;">
				<span class="popup-swatch" style="background:{activeSeg.color}"></span>
				<!-- La sigla y no el nombre completo: el popup es una etiqueta de un trozo
			     de gráfico, no una ficha del partido, y "EUZKO ALDERDI
			     JELTZALEA-PARTIDO NACIONALISTA VASCO" ocupaba tres líneas para decir
			     EAJ-PNV. Las siglas son las que el lector acaba de ver en la leyenda,
			     en la tabla y en el mapa. -->
			<span class="popup-name">{activeSeg.siglas}</span>
				<span class="popup-seats">{activeSeg.seats} esc.</span>
			</div>
		{/if}

		<ul class="legend">
			{#each sinJornada ? leyendaAnterior : leyenda as p (p.siglas)}
				<li class="entry">
					<span class="swatch" style="background:{p.color}"></span>
					<span class="entry-name">{p.siglas}</span>
					<span class="entry-value">{p.escanos}</span>
				</li>
			{/each}
		</ul>
		{#if sinJornada}
			<p class="leyenda-nota">Escaños de {CONVOCATORIA_ANTERIOR} — el {CONVOCATORIA} aún sin escrutar</p>
		{/if}
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
	}

	.hemiciclo {
		width: 100%;
		max-width: 420px;
	}

	.seg-label {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 700;
	}

	/* Filete blanco entre arcos (26/11). Sustituye al contorno gris de los dos
	   anillos: separa partido de partido en vez de encuadrar el dibujo.

	   Va en el `stroke` del propio arco, así que el filete queda a caballo entre
	   los dos vecinos y ninguno pierde superficie respecto al otro — el reparto
	   sigue siendo proporcional a los escaños. 1px en un viewBox de 400 de ancho
	   es un pelo a cualquier tamaño de pantalla. */
	.seg-hover {
		cursor: pointer;
		stroke: var(--paper);
		stroke-width: 1;
	}

	.seg-hover:hover {
		filter: brightness(0.92);
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

	.centre-label {
		fill: var(--grey);
		font-family: var(--font-body);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.centre-number {
		fill: var(--ink);
		font-family: var(--font-mono);
		font-size: 28px;
		font-weight: 700;
	}

	.seg-label-sm {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
	}

	.pole-label {
		fill: var(--ink);
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
	}

	.pole-label-sm {
		fill: var(--grey);
		font-family: var(--font-mono);
		font-size: 9px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 3px 12px;
		margin: 8px 0 12px 0;
		padding: 0;
		list-style: none;
		width: 100%;
	}

	.leyenda-nota {
		margin: -4px 0 12px 0;
		text-align: center;
		font-family: var(--font-body);
		font-size: 10px;
		font-style: italic;
		color: var(--grey);
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
</style>
