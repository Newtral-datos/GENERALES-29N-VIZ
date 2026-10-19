// Helpers compartidos para generar imágenes de "compartir en redes" a partir
// de un <canvas> — usados tanto por el simulador de pactos como por el botón
// de compartir resultados de la home del Congreso. Centralizados aquí porque
// los dos sitios necesitan exactamente la misma mecánica (texto con huecos
// calculados por métrica real de fuente, insignia de líder con/sin foto,
// exportar + Web Share API) y duplicarla invita a que diverjan con el tiempo.

export const COLOR = {
	ink: '#0a0e14',
	grey: '#6b7280',
	paper: '#f8fafc',
	teal: '#01f3b3',
	tealDark: '#00b38a',
	ok: '#0a7a4a',
	down: '#d7263d',
	rule: '#d9dcdf',
	chip: '#f0f0f0'
};

// Enlace fijo del pie de cualquier imagen para compartir — la cobertura en
// directo de Newtral de la jornada, no la URL del panel en sí.
export const URL_COMPARTIR = 'www.newtral.es/directo-resultados-elecciones-29n';

// Dibujar una foto en un <canvas> y luego exportarlo (toBlob/toDataURL) solo
// funciona si el servidor que la sirve manda Access-Control-Allow-Origin —
// si no, el canvas queda "tainted" y la exportación entera falla con
// SecurityError. Comprobado con curl -I: el bucket s3transparentia de
// Newtral NO manda esa cabecera, pero live.staticflickr.com sí. Por eso solo
// se intenta cargar la foto real cuando la URL es de un host conocido así —
// cualquier otra fuente cae a un distintivo de color+sigla, para no reventar
// la imagen entera si en el futuro se añade una URL de un sitio sin CORS sin
// darse cuenta.
const HOST_FOTO_CON_CORS = /^https:\/\/live\.staticflickr\.com\//;

export function fotoEsSeguraParaCanvas(url: string): boolean {
	return HOST_FOTO_CON_CORS.test(url);
}

const cacheImagenes = new Map<string, Promise<HTMLImageElement>>();

export function cargarImagen(url: string): Promise<HTMLImageElement> {
	let p = cacheImagenes.get(url);
	if (!p) {
		p = new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`No se ha podido cargar ${url}`));
			img.src = url;
		});
		cacheImagenes.set(url, p);
	}
	return p;
}

export function dibujarTextoEspaciado(
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

export function partirEnLineas(ctx: CanvasRenderingContext2D, texto: string, anchoMax: number): string[] {
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

export function tituloCaso(texto: string): string {
	return texto
		.toLowerCase()
		.split(' ')
		.map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
		.join(' ');
}

// Dibujar texto en <canvas> coloca la línea base donde le digas, pero el
// propio glifo sube por encima de esa línea (el "ascent") una cantidad que
// depende del tamaño de fuente — con un número grande (p. ej. 130px) eso son
// ~100px. Calcular el hueco entre bloques a base de sumar píxeles fijos a
// ojo se queda corto en cuanto cambia el tamaño de letra y un bloque grande
// se come el texto de arriba. Estos helpers reciben siempre el borde
// SUPERIOR del siguiente bloque (nunca una línea base) y devuelven el borde
// superior del bloque que viene después, calculado a partir del tamaño real
// de fuente — así el hueco entre bloques es siempre el que se pide, sin
// importar lo grande que sea la letra.
const ASCENSO = 0.78;
const DESCENSO = 0.22;

export function dibujarLinea(
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

export function dibujarLineas(
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

// Insignia circular de líder: foto real recortada si la URL es de una fuente
// seguro-CORS (ver fotoEsSeguraParaCanvas), si no un distintivo de
// color+sigla — nunca a medias ni rompiendo la exportación.
export async function dibujarInsigniaCircular(
	ctx: CanvasRenderingContext2D,
	opts: { cx: number; yTop: number; r: number; color: string; siglas: string; foto?: string; fontSizePx?: number }
): Promise<void> {
	const { cx, yTop, r, color, siglas, foto } = opts;
	const fontSizePx = opts.fontSizePx ?? 38;

	let imagen: HTMLImageElement | null = null;
	if (foto && fotoEsSeguraParaCanvas(foto)) {
		try {
			imagen = await cargarImagen(foto);
		} catch {
			imagen = null;
		}
	}

	if (imagen) {
		ctx.save();
		ctx.beginPath();
		ctx.arc(cx, yTop + r, r, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();
		const lado = Math.min(imagen.width, imagen.height);
		const sx = (imagen.width - lado) / 2;
		// Los retratos (más altos que anchos) suelen tener la cara en el
		// tercio superior, no en el centro — anclar el recorte cerca de
		// arriba evita dejarla pequeña y hundida hacia abajo en el círculo.
		const esRetrato = imagen.height > imagen.width;
		const sy = (imagen.height - lado) * (esRetrato ? 0.15 : 0.5);
		ctx.drawImage(imagen, sx, sy, lado, lado, cx - r, yTop, r * 2, r * 2);
		ctx.restore();
		ctx.lineWidth = 5;
		ctx.strokeStyle = color;
		ctx.beginPath();
		ctx.arc(cx, yTop + r, r, 0, Math.PI * 2);
		ctx.stroke();
	} else {
		ctx.beginPath();
		ctx.arc(cx, yTop + r, r, 0, Math.PI * 2);
		ctx.fillStyle = '#ffffff';
		ctx.fill();
		ctx.lineWidth = 5;
		ctx.strokeStyle = color;
		ctx.stroke();
		ctx.fillStyle = color;
		ctx.font = `800 ${fontSizePx}px "Helvetica Neue", Arial, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(siglas, cx, yTop + r);
	}
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
}

export function recortarCanvas(origen: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
	const final = document.createElement('canvas');
	final.width = w;
	final.height = h;
	const ctx = final.getContext('2d');
	if (ctx) ctx.drawImage(origen, 0, 0, w, h, 0, 0, w, h);
	return final;
}

export function canvasABlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function descargarBlob(blob: Blob, nombreArchivo: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = nombreArchivo;
	a.click();
	URL.revokeObjectURL(url);
}

// Copia la imagen al portapapeles del sistema (Clipboard API con
// ClipboardItem) — soportado en Chrome/Safari/Edge de escritorio con gesto
// de usuario. Requiere que la pestaña siga teniendo el foco en el momento de
// escribir, así que hay que llamarlo ANTES de abrir cualquier pestaña nueva
// (window.open le roba el foco y la escritura fallaría con "Document is not
// focused"). Devuelve false si el navegador no lo soporta o si falla, nunca
// lanza — el llamante decide el fallback (normalmente descargarBlob).
export async function copiarAlPortapapeles(blob: Blob): Promise<boolean> {
	try {
		if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
		return true;
	} catch {
		return false;
	}
}

// Exporta el canvas como PNG: si el share sheet nativo soporta ficheros (hoy,
// sobre todo móvil), lo usa directamente — entrega imagen + texto a la app
// que elija el usuario (X, WhatsApp, Mensajes...). Si no existe (Chrome/Safari
// de escritorio normalmente no lo soportan), cae a una descarga normal.
export async function exportarOCompartir(
	canvas: HTMLCanvasElement,
	nombreArchivo: string,
	datos: { title: string; text: string }
): Promise<void> {
	const blob = await canvasABlob(canvas);
	if (!blob) return;

	const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
	const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

	if (nav.canShare?.({ files: [archivo] })) {
		try {
			await navigator.share({ files: [archivo], title: datos.title, text: datos.text });
			return;
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
		}
	}

	descargarBlob(blob, nombreArchivo);
}

export type RedSocial = 'x' | 'whatsapp';

const URL_RED: Record<RedSocial, (texto: string) => string> = {
	x: (texto) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}`,
	whatsapp: (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`
};

// Esta ruta (copiar + abrir el compositor web) solo es fiable en escritorio.
// En móvil, el enlace de intent de X no lleva ficheros (solo texto/enlace, es
// una limitación de la propia red) y además, si abre la app nativa en vez
// del navegador, el texto del intent muchas veces ni siquiera llega — ahí la
// única vía que de verdad entrega imagen + texto a la app es el share sheet
// del sistema (ver exportarOCompartir). Por eso CompartirMenu solo ofrece
// estos botones de red cuando el share sheet nativo no está disponible.
export function abrirRed(red: RedSocial, texto: string) {
	window.open(URL_RED[red](texto), '_blank', 'noopener,noreferrer');
}
