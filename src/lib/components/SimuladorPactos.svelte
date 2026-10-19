<script lang="ts">
	import { getResultados23j, type Nacional, type Partido } from '#lib/data';
	import logoUrl from '#lib/assets/logo-newtral.png';

	// Fotos de líder por sigla. Se comprobó cada URL con un HEAD antes de usarla
	// (ver AGENTS.md: nunca inventar avatar ni buscar foto fuera de una fuente
	// de confianza). Las de Flickr (live.staticflickr.com) llevan cabecera
	// Access-Control-Allow-Origin: *, así que además de salir en la ficha
	// pueden dibujarse en el <canvas> de "Compartir mi apuesta" sin problema
	// de tainted canvas — al contrario que el bucket s3transparentia (sin
	// CORS), por eso Feijóo/Sánchez se han movido también a Flickr.
	// SUMAR ahora se presenta como "Frente Amplio" con Ada Colau — el dato
	// sigue llegando con siglas:"SUMAR" en el JSON (23J de prueba), así que la
	// clave aquí tiene que seguir siendo esa para que la ficha la recoja; el
	// nombre visible de la marca es cosa del pipeline de datos, no de este
	// mapa. "Podemos" no tiene fila propia todavía en nacional.partidos (en
	// los datos de prueba de 23J va dentro de SUMAR) — se deja ya cargada para
	// cuando la convocatoria real sí la traiga desglosada. El resto se deja en
	// blanco hasta tener URL confirmada; no hace falta tocar nada más, el
	// resto del componente ya resuelve el líder que falte con un hueco vacío.
	const LIDERES: Record<string, { nombre: string; foto: string }> = {
		PP: {
			nombre: 'Alberto Núñez Feijóo',
			foto: 'https://live.staticflickr.com/65535/55597696582_a1af1a748c.jpg'
		},
		PSOE: {
			nombre: 'Pedro Sánchez',
			foto: 'https://live.staticflickr.com/65535/55599113145_0c862ce7c6_t.jpg'
		},
		VOX: {
			nombre: 'Santiago Abascal',
			foto: 'https://live.staticflickr.com/65535/55598714331_8286c5b4cb_t.jpg'
		},
		SUMAR: {
			nombre: 'Ada Colau',
			foto: 'https://live.staticflickr.com/65535/55598714326_0554aa72c2.jpg'
		},
		Podemos: {
			nombre: 'Irene Montero',
			foto: 'https://live.staticflickr.com/65535/55598907244_3d57d2db05_t.jpg'
		}
	};

	let nacional = $state<Nacional | null>(null);

	// Solo puede haber un candidato a presidente a la vez (cualquier partido con
	// escaño, no solo los dos más grandes). Los aliados se eligen una vez hay
	// presidente elegido; elegir un presidente distinto reinicia los aliados.
	let presidente = $state<string | null>(null);
	let aliados = $state<Set<string>>(new Set());

	$effect(() => {
		getResultados23j().then((d) => {
			nacional = d.nacional;
			presidente = null;
			aliados = new Set();
		});
	});

	// Con escaño = puede gobernar o ser aliado, se muestra arriba como ficha
	// tocable. Sin escaño = no puede sumar nada a una mayoría, se muestra abajo
	// como listado informativo. Ambas listas salen de los datos, no de una
	// lista fija de partidos en el código: si en una actualización de la noche
	// electoral un partido pasa de 0 a 1+ escaños, sube solo a la lista de
	// arriba en el siguiente fetch.
	let conEscano = $derived(
		nacional ? [...nacional.partidos].filter((p) => p.escanos > 0).sort((a, b) => b.escanos - a.escanos) : []
	);
	let sinEscano = $derived(nacional ? nacional.partidos.filter((p) => p.escanos === 0) : []);

	function toggle(siglas: string) {
		if (siglas === presidente) {
			reiniciar();
			return;
		}
		if (!presidente) {
			presidente = siglas;
			aliados = new Set();
			return;
		}
		const next = new Set(aliados);
		if (next.has(siglas)) {
			next.delete(siglas);
		} else {
			next.add(siglas);
		}
		aliados = next;
	}

	function reiniciar() {
		presidente = null;
		aliados = new Set();
	}

	let partidoPresidente = $derived(conEscano.find((p) => p.siglas === presidente) ?? null);
	let liderPresidente = $derived(presidente ? LIDERES[presidente] : undefined);

	let partidosAliados = $derived(
		presidente ? conEscano.filter((p) => aliados.has(p.siglas)).sort((a, b) => b.escanos - a.escanos) : []
	);

	let seatsPacto = $derived(
		partidoPresidente ? partidoPresidente.escanos + partidosAliados.reduce((s, p) => s + p.escanos, 0) : 0
	);

	let segmentos = $derived<Partido[]>(partidoPresidente ? [partidoPresidente, ...partidosAliados] : []);

	let pctLibre = $derived(nacional ? 100 - (seatsPacto / nacional.totalEscanos) * 100 : 100);
	let mayoriaPct = $derived(nacional ? (nacional.mayoria / nacional.totalEscanos) * 100 : 0);

	// --- Compartir la apuesta como imagen ---------------------------------
	// Dibujar una foto de líder en un <canvas> y luego exportarlo
	// (toBlob/toDataURL) solo funciona si el servidor que la sirve manda
	// Access-Control-Allow-Origin — si no, el canvas queda "tainted" y la
	// exportación entera falla con SecurityError. Comprobado con curl -I:
	// el bucket s3transparentia de Newtral NO manda esa cabecera, pero
	// live.staticflickr.com (donde viven las fotos de LIDERES) sí. Por eso
	// solo se intenta cargar la foto real cuando la URL es de ese host
	// conocido — cualquier otra fuente (o ausencia de foto) cae al
	// distintivo de color+sigla, para no reventar la imagen entera si en el
	// futuro se añade una URL de un sitio sin CORS sin darse cuenta.
	let generandoImagen = $state(false);

	const HOST_FOTO_CON_CORS = /^https:\/\/live\.staticflickr\.com\//;

	// Enlace fijo del pie de la imagen para compartir (no la URL del panel en
	// sí, sino la cobertura en directo de Newtral de la jornada).
	const URL_COMPARTIR = 'www.newtral.es/directo-resultados-elecciones-29n';

	let logoImgPromise: Promise<HTMLImageElement> | null = null;
	function cargarLogo(): Promise<HTMLImageElement> {
		if (!logoImgPromise) {
			logoImgPromise = new Promise((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = () => reject(new Error('No se ha podido cargar el logo'));
				img.src = logoUrl;
			});
		}
		return logoImgPromise;
	}

	function cargarFotoConCors(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('No se ha podido cargar la foto'));
			img.src = url;
		});
	}

	function dibujarTextoEspaciado(
		ctx: CanvasRenderingContext2D,
		texto: string,
		x: number,
		y: number,
		espacio: number
	) {
		let cx = x;
		for (const letra of texto) {
			ctx.fillText(letra, cx, y);
			cx += ctx.measureText(letra).width + espacio;
		}
	}

	function partirEnLineas(ctx: CanvasRenderingContext2D, texto: string, anchoMax: number): string[] {
		const palabras = texto.split(' ');
		const lineas: string[] = [];
		let actual = '';
		for (const palabra of palabras) {
			const prueba = actual ? `${actual} ${palabra}` : palabra;
			if (actual && ctx.measureText(prueba).width > anchoMax) {
				lineas.push(actual);
				actual = palabra;
			} else {
				actual = prueba;
			}
		}
		if (actual) lineas.push(actual);
		return lineas;
	}

	function tituloCaso(texto: string): string {
		return texto
			.toLowerCase()
			.split(' ')
			.map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
			.join(' ');
	}

	// Dibujar texto en <canvas> coloca la línea base donde le digas, pero el
	// propio glifo sube por encima de esa línea (el "ascent") una cantidad que
	// depende del tamaño de fuente — con el número de escaños a 130px eso son
	// ~100px. Calcular el hueco entre bloques a base de sumar píxeles fijos a
	// ojo (como se hacía antes) se queda corto en cuanto cambia el tamaño de
	// letra y el número se come el texto de arriba. Estos helpers reciben
	// siempre el borde SUPERIOR del siguiente bloque (nunca una línea base) y
	// devuelven el borde superior del bloque que viene después, calculado a
	// partir del tamaño real de fuente — así el hueco entre bloques es
	// siempre el que se pide, sin importar lo grande que sea la letra.
	const ASCENSO = 0.78;
	const DESCENSO = 0.22;

	function dibujarLinea(
		ctx: CanvasRenderingContext2D,
		texto: string,
		x: number,
		yArriba: number,
		fontSizePx: number,
		huecoDespues: number
	): number {
		ctx.fillText(texto, x, yArriba + fontSizePx * ASCENSO);
		return yArriba + fontSizePx * (ASCENSO + DESCENSO) + huecoDespues;
	}

	function dibujarLineas(
		ctx: CanvasRenderingContext2D,
		lineas: string[],
		x: number,
		yArriba: number,
		fontSizePx: number,
		altoLinea: number,
		huecoDespues: number
	): number {
		let base = yArriba + fontSizePx * ASCENSO;
		for (const linea of lineas) {
			ctx.fillText(linea, x, base);
			base += altoLinea;
		}
		return base - altoLinea + fontSizePx * DESCENSO + huecoDespues;
	}

	async function compartirApuesta() {
		if (!nacional || !partidoPresidente || generandoImagen) return;
		generandoImagen = true;
		try {
			const W = 1080;
			const MAX_H = 1800;
			const lienzo = document.createElement('canvas');
			lienzo.width = W;
			lienzo.height = MAX_H;
			const ctx = lienzo.getContext('2d');
			if (!ctx) return;

			const margen = 64;
			const anchoContenido = W - margen * 2;

			ctx.fillStyle = '#f8fafc';
			ctx.fillRect(0, 0, W, MAX_H);
			ctx.fillStyle = '#01f3b3';
			ctx.fillRect(0, 0, W, 10);

			const logoImg = await cargarLogo();
			const logoW = 220;
			const logoH = logoW * (logoImg.height / logoImg.width);
			ctx.drawImage(logoImg, margen, 64, logoW, logoH);

			let y = 64 + logoH + 48;

			ctx.fillStyle = '#6b7280';
			ctx.font = '700 15px "Helvetica Neue", Arial, sans-serif';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'alphabetic';
			dibujarTextoEspaciado(ctx, 'SIMULADOR DE PACTOS — GENERALES 29N', margen, y, 2.5);

			y += 90;

			const cx = W / 2;
			const r = 90;

			let fotoLider: HTMLImageElement | null = null;
			if (liderPresidente && HOST_FOTO_CON_CORS.test(liderPresidente.foto)) {
				try {
					fotoLider = await cargarFotoConCors(liderPresidente.foto);
				} catch {
					fotoLider = null;
				}
			}

			if (fotoLider) {
				ctx.save();
				ctx.beginPath();
				ctx.arc(cx, y + r, r, 0, Math.PI * 2);
				ctx.closePath();
				ctx.clip();
				const lado = Math.min(fotoLider.width, fotoLider.height);
				const sx = (fotoLider.width - lado) / 2;
				// Los retratos (más altos que anchos) suelen tener la cara en el
				// tercio superior, no en el centro — anclar el recorte cerca de
				// arriba (en vez de centrado) evita dejarla pequeña y hundida
				// hacia abajo dentro del círculo. Comprobado recortando la foto
				// real de Feijóo con distintos anclajes antes de fijar el 0.15.
				const esRetrato = fotoLider.height > fotoLider.width;
				const sy = (fotoLider.height - lado) * (esRetrato ? 0.15 : 0.5);
				ctx.drawImage(fotoLider, sx, sy, lado, lado, cx - r, y, r * 2, r * 2);
				ctx.restore();
				ctx.lineWidth = 5;
				ctx.strokeStyle = partidoPresidente.color;
				ctx.beginPath();
				ctx.arc(cx, y + r, r, 0, Math.PI * 2);
				ctx.stroke();
			} else {
				ctx.beginPath();
				ctx.arc(cx, y + r, r, 0, Math.PI * 2);
				ctx.fillStyle = '#ffffff';
				ctx.fill();
				ctx.lineWidth = 5;
				ctx.strokeStyle = partidoPresidente.color;
				ctx.stroke();
				ctx.fillStyle = partidoPresidente.color;
				ctx.font = '800 38px "Helvetica Neue", Arial, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(partidoPresidente.siglas, cx, y + r);
			}

			y += r * 2 + 40;

			ctx.fillStyle = '#0a0e14';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'alphabetic';
			const FS_TITULO = 46;
			ctx.font = `800 ${FS_TITULO}px "Helvetica Neue", Arial, sans-serif`;
			const titulo = liderPresidente?.nombre ?? tituloCaso(partidoPresidente.nombre);
			const lineasTitulo = partirEnLineas(ctx, titulo, anchoContenido);
			y = dibujarLineas(ctx, lineasTitulo, cx, y, FS_TITULO, FS_TITULO * 1.18, 18);

			if (partidosAliados.length) {
				ctx.fillStyle = '#6b7280';
				const FS_ALIADOS = 24;
				ctx.font = `600 ${FS_ALIADOS}px "Helvetica Neue", Arial, sans-serif`;
				const aliadosTxt = `Con ${partidosAliados.map((p) => p.siglas).join(' | ')}`;
				const lineasAliados = partirEnLineas(ctx, aliadosTxt, anchoContenido);
				y = dibujarLineas(ctx, lineasAliados, cx, y, FS_ALIADOS, FS_ALIADOS * 1.3, 0);
			}

			y += 36;

			ctx.fillStyle = '#0a0e14';
			const FS_NUM = 130;
			ctx.font = `800 ${FS_NUM}px ui-monospace, "SF Mono", Menlo, monospace`;
			y = dibujarLinea(ctx, String(seatsPacto), cx, y, FS_NUM, 14);

			ctx.fillStyle = '#6b7280';
			const FS_SUB = 30;
			ctx.font = `500 ${FS_SUB}px ui-monospace, "SF Mono", Menlo, monospace`;
			y = dibujarLinea(ctx, `de ${nacional.mayoria} para la mayoría`, cx, y, FS_SUB, 28);

			ctx.fillStyle = seatsPacto >= nacional.mayoria ? '#0a7a4a' : '#6b7280';
			const FS_STATUS = 30;
			ctx.font = `700 ${FS_STATUS}px "Helvetica Neue", Arial, sans-serif`;
			y = dibujarLinea(
				ctx,
				seatsPacto >= nacional.mayoria ? 'Suma mayoría' : `Faltan ${nacional.mayoria - seatsPacto} escaños`,
				cx,
				y,
				FS_STATUS,
				44
			);

			const barH = 50;
			ctx.fillStyle = '#f0f0f0';
			ctx.fillRect(margen, y, anchoContenido, barH);
			let bx = margen;
			for (const p of segmentos) {
				const segW = (p.escanos / nacional.totalEscanos) * anchoContenido;
				ctx.fillStyle = p.color;
				ctx.fillRect(bx, y, segW, barH);
				bx += segW;
			}

			const mx = margen + (nacional.mayoria / nacional.totalEscanos) * anchoContenido;
			ctx.strokeStyle = '#0a0e14';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(mx, y - 10);
			ctx.lineTo(mx, y + barH + 10);
			ctx.stroke();
			ctx.fillStyle = '#0a0e14';
			ctx.font = '700 18px "Helvetica Neue", Arial, sans-serif';
			ctx.fillText(`Mayoría (${nacional.mayoria})`, mx, y - 20);

			y += barH + 70;

			ctx.strokeStyle = '#d9dcdf';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(margen, y);
			ctx.lineTo(W - margen, y);
			ctx.stroke();

			y += 42;

			ctx.fillStyle = '#6b7280';
			const FS_PIE1 = 24;
			ctx.font = `600 ${FS_PIE1}px "Helvetica Neue", Arial, sans-serif`;
			y = dibujarLinea(ctx, 'Haz tu propia apuesta en', cx, y, FS_PIE1, 6);

			ctx.fillStyle = '#00b38a';
			const FS_PIE2 = 26;
			ctx.font = `700 ${FS_PIE2}px "Helvetica Neue", Arial, sans-serif`;
			y = dibujarLinea(ctx, URL_COMPARTIR.replace(/^https?:\/\//, ''), cx, y, FS_PIE2, 40);

			const final = document.createElement('canvas');
			final.width = W;
			final.height = y;
			const ctxFinal = final.getContext('2d');
			if (!ctxFinal) return;
			ctxFinal.drawImage(lienzo, 0, 0, W, y, 0, 0, W, y);

			const blob: Blob | null = await new Promise((resolve) => ctxFinal.canvas.toBlob(resolve, 'image/png'));
			if (!blob) return;

			const archivo = new File([blob], 'mi-apuesta-generales29n.png', { type: 'image/png' });
			const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

			if (nav.canShare?.({ files: [archivo] })) {
				try {
					await navigator.share({
						files: [archivo],
						title: 'Mi apuesta de Gobierno',
						text: 'Esta es mi predicción de los resultados de las elecciones del 29N en el simulador de pactos de @Newtral: www.newtral.es/directo-resultados-elecciones-29n/'
					});
					return;
				} catch (err) {
					if ((err as Error).name === 'AbortError') return;
				}
			}

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'mi-apuesta-generales29n.png';
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			generandoImagen = false;
		}
	}
</script>

{#if !nacional}
	<p class="loading">Cargando datos…</p>
{:else}
	<div class="simulador">
		<ul class="grid-lideres">
			{#each conEscano as p (p.siglas)}
				{@const lider = LIDERES[p.siglas]}
				{@const esPresidente = presidente === p.siglas}
				{@const esAliado = aliados.has(p.siglas)}
				<li>
					<button
						type="button"
						class="ficha"
						class:activo={esPresidente}
						class:aliado={esAliado}
						style="--pc:{p.color}"
						onclick={() => toggle(p.siglas)}
						aria-pressed={esPresidente || esAliado}
						title={p.nombre}
					>
						<span class="ficha-avatar">
							{#if lider}
								<img src={lider.foto} alt={lider.nombre} class="ficha-avatar-img" />
							{/if}
						</span>
						<span class="ficha-siglas">{p.siglas}</span>
						<span class="ficha-escanos">{p.escanos}</span>
					</button>
				</li>
			{/each}
		</ul>

		<div class="resultado">
			{#if partidoPresidente}
				<div class="hero" style="--pc:{partidoPresidente.color}">
					<span class="hero-avatar">
						{#if liderPresidente}
							<img src={liderPresidente.foto} alt={liderPresidente.nombre} class="hero-avatar-img" />
						{/if}
					</span>
					<div class="hero-info">
						{#if liderPresidente}
							<span class="hero-nombre">{liderPresidente.nombre}</span>
						{/if}
						<span class="hero-partido">{partidoPresidente.siglas}</span>
					</div>
					<div class="hero-count">
						<span class="hero-count-num">{seatsPacto}<span class="hero-count-total">/{nacional.mayoria}</span></span>
						<span class="hero-status" class:gana={seatsPacto >= nacional.mayoria}>
							{#if seatsPacto >= nacional.mayoria}
								Suma mayoría
							{:else}
								Faltan {nacional.mayoria - seatsPacto}
							{/if}
						</span>
					</div>
					<button class="reset" onclick={reiniciar}>Reiniciar</button>
				</div>
			{:else}
				<p class="instrucciones">Toca un partido para elegir quién intenta formar gobierno.</p>
			{/if}

			<div class="barra-wrap">
				<div class="barra-track">
					{#each segmentos as p (p.siglas)}
						{@const pct = (p.escanos / nacional.totalEscanos) * 100}
						<div class="barra-seg" style="width:{pct}%; --seg-color:{p.color}">
							{#if pct >= 4}<span class="barra-seg-label">{p.escanos}</span>{/if}
						</div>
					{/each}
					<div class="barra-libre" style="width:{pctLibre}%"></div>
				</div>
				<div class="maj-marker" style="left:{mayoriaPct}%">
					<span class="maj-text">Mayoría<br /><b>{nacional.mayoria}</b></span>
					<span class="maj-line"></span>
				</div>
			</div>

			{#if partidoPresidente}
				<button class="compartir" onclick={compartirApuesta} disabled={generandoImagen}>
					{generandoImagen ? 'Generando…' : 'Compartir mi apuesta'}
				</button>
			{/if}
		</div>

		{#if sinEscano.length}
			<div class="sin-escano">
				<p class="sin-escano-titulo">Sin representación parlamentaria</p>
				<ul class="sin-escano-lista">
					{#each sinEscano as p (p.siglas)}
						{@const lider = LIDERES[p.siglas]}
						<li class="sin-escano-item">
							<span class="sin-escano-avatar">
								{#if lider}
									<img src={lider.foto} alt={lider.nombre} class="sin-escano-avatar-img" />
								{/if}
							</span>
							<span class="sin-escano-siglas">{p.siglas}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

<style>
	.loading {
		font-size: 12px;
		color: var(--grey);
		font-family: var(--font-body);
		padding: 40px 0;
		text-align: center;
	}

	.simulador {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}

	.grid-lideres {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
		gap: 8px;
		width: 100%;
		max-width: 680px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.ficha {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		height: 110px;
		background: var(--paper);
		border: 1px solid var(--border);
		padding: 10px 6px;
		font-family: inherit;
		cursor: pointer;
		transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
	}

	.ficha:hover {
		border-color: var(--pc);
		box-shadow: var(--shadow-hard);
		transform: translate(-2px, -2px);
	}

	.ficha:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.ficha.activo {
		border-color: var(--pc);
		border-width: 2px;
		background: color-mix(in srgb, var(--pc) 8%, var(--paper));
	}

	.ficha.aliado {
		border-color: var(--pc);
		background: color-mix(in srgb, var(--pc) 6%, var(--paper));
	}

	.ficha-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--border);
		background: #f0f0f0;
		flex-shrink: 0;
	}

	.ficha.activo .ficha-avatar,
	.ficha.aliado .ficha-avatar {
		border-color: var(--pc);
	}

	.ficha-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* Los retratos de candidato suelen llevar la cara en el tercio
		   superior, no en el centro — centrar el recorte la deja pequeña y
		   hundida hacia la barbilla. */
		object-position: 50% 20%;
		display: block;
	}

	.ficha-siglas {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
		width: 100%;
		height: 2.6em;
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 700;
		line-height: 1.3;
		letter-spacing: 0.01em;
		color: var(--ink);
		text-align: center;
	}

	.ficha-escanos {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--grey);
	}

	.resultado {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		width: 100%;
	}

	.instrucciones {
		font-family: var(--font-body);
		font-size: 12px;
		font-style: italic;
		color: var(--grey);
		text-align: center;
		max-width: 56ch;
		margin: 0;
		padding: 16px 0;
	}

	.hero {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 14px;
		width: 100%;
		max-width: 680px;
		background: var(--paper);
		border: 1px solid var(--border);
		border-left: 3px solid var(--pc);
		padding: 12px 16px;
	}

	.hero-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		overflow: hidden;
		border: 2px solid var(--pc);
		background: #f0f0f0;
		flex-shrink: 0;
	}

	.hero-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 20%;
		display: block;
	}

	.hero-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.hero-nombre {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 700;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hero-partido {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grey);
	}

	.hero-count {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}

	.hero-count-num {
		font-family: var(--font-mono);
		font-size: 22px;
		font-weight: 700;
		color: var(--ink);
	}

	.hero-count-total {
		font-size: 13px;
		font-weight: 500;
		color: var(--grey);
	}

	.hero-status {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		color: var(--grey);
		white-space: nowrap;
	}

	.hero-status.gana {
		color: #0a7a4a;
	}

	.reset {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--grey);
		background: none;
		border: 1px solid var(--border);
		padding: 6px 10px;
		cursor: pointer;
		white-space: nowrap;
	}

	.reset:hover {
		color: var(--ink);
		border-color: var(--ink);
	}

	.barra-wrap {
		position: relative;
		width: 100%;
		max-width: 680px;
		padding-top: 30px;
	}

	.barra-track {
		display: flex;
		width: 100%;
		height: 34px;
		background: #f0f0f0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		overflow: hidden;
	}

	.barra-seg {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		background: var(--seg-color);
		border-right: 1px solid rgba(255, 255, 255, 0.5);
		transition: width 0.25s ease;
	}

	.barra-seg:last-child {
		border-right: none;
	}

	.barra-seg-label {
		color: #fff;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
	}

	.barra-libre {
		height: 100%;
		background: repeating-linear-gradient(135deg, #e5e7eb, #e5e7eb 4px, #ededed 4px, #ededed 8px);
		transition: width 0.25s ease;
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
		margin-bottom: 8px;
	}

	.maj-text b {
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.maj-line {
		width: 1px;
		height: 34px;
		background: var(--ink);
	}

	.compartir {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink);
		background: var(--c);
		border: 1px solid var(--ink);
		padding: 10px 20px;
		cursor: pointer;
		transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
	}

	.compartir:hover:not(:disabled) {
		background: var(--cd);
		box-shadow: var(--shadow-hard);
		transform: translate(-2px, -2px);
	}

	.compartir:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.compartir:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.sin-escano {
		width: 100%;
		max-width: 680px;
		border-top: 1px solid var(--border);
		padding-top: 14px;
	}

	.sin-escano-titulo {
		font-family: var(--font-body);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--grey);
		text-align: center;
		margin: 0 0 10px 0;
	}

	.sin-escano-lista {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.sin-escano-item {
		display: flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--border);
		padding: 4px 8px 4px 4px;
		opacity: 0.7;
	}

	.sin-escano-avatar {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		overflow: hidden;
		background: #f0f0f0;
		flex-shrink: 0;
	}

	.sin-escano-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 20%;
		display: block;
	}

	.sin-escano-siglas {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		color: var(--grey);
	}

	@media (max-width: 640px) {
		.grid-lideres {
			grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
		}

		.ficha {
			height: 100px;
		}

		.hero {
			grid-template-columns: auto 1fr auto;
			grid-template-rows: auto auto;
			gap: 8px 10px;
		}

		.hero-count {
			grid-column: 2;
			grid-row: 2;
			align-items: flex-start;
		}

		.reset {
			grid-column: 3;
			grid-row: 2;
		}
	}
</style>
