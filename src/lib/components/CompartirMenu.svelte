<script lang="ts">
	import {
		abrirRed,
		canvasABlob,
		copiarAlPortapapeles,
		descargarBlob,
		exportarOCompartir,
		type RedSocial
	} from '#lib/compartir-imagen';

	let {
		generar,
		nombreArchivo,
		texto,
		etiqueta = 'Compartir',
		variante = 'discreta'
	}: {
		generar: () => Promise<HTMLCanvasElement>;
		nombreArchivo: string;
		texto: string;
		etiqueta?: string;
		variante?: 'primaria' | 'discreta';
	} = $props();

	let abierto = $state(false);
	let generando = $state(false);

	// En móvil (Chrome/Android, Safari/iOS) navigator.share con ficheros abre
	// el share sheet del sistema, que ahí sí lista las apps de redes
	// instaladas (X, WhatsApp, Mensajes...) y les entrega imagen + texto
	// juntos — es la única vía fiable ahí, así que se vuelve la acción
	// principal del botón, sin menú de por medio.
	//
	// En escritorio (Safari/Mac incluido) navigator.canShare también existe
	// como función, pero el share sheet del sistema solo enseña Mail/
	// Mensajes/AirDrop — nunca X ni WhatsApp — así que comprobar solo si la
	// API existe toma el escritorio por móvil y esconde los botones de red.
	// Hace falta distinguir plataforma de verdad, no solo soporte de API.
	let compartirNativoDisponible = $state(false);
	$effect(() => {
		const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; userAgentData?: { mobile?: boolean } };
		const esMovil = nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
		compartirNativoDisponible = esMovil && typeof nav.canShare === 'function';
	});

	async function conCanvas(accion: (canvas: HTMLCanvasElement) => Promise<void>) {
		if (generando) return;
		generando = true;
		abierto = false;
		try {
			const canvas = await generar();
			await accion(canvas);
		} finally {
			generando = false;
		}
	}

	// Ninguna red deja que una web le pegue una imagen por detrás — hay que
	// pegarla a mano con ⌘V/Ctrl+V en su cuadro de texto. Un aviso flotente
	// que aparece a la vez que el foco salta a la pestaña nueva pasa
	// desapercibido (comprobado), así que se usa un confirm() que bloquea
	// hasta que se lee, ANTES de abrir la pestaña — y de paso, al ser un
	// gesto de usuario, evita que el navegador bloquee el popup.
	function aRed(red: RedSocial) {
		conCanvas(async (canvas) => {
			const blob = await canvasABlob(canvas);
			if (!blob) return;
			const copiada = await copiarAlPortapapeles(blob);
			if (!copiada) descargarBlob(blob, nombreArchivo);
			const nombreRed = red === 'x' ? 'X' : 'WhatsApp';
			const seguir = window.confirm(
				copiada
					? `Imagen copiada. Al pulsar Aceptar se abre ${nombreRed} — pégala con ⌘V (Mac) o Ctrl+V (Windows) en el cuadro de texto.`
					: `No se ha podido copiar la imagen, así que se ha descargado. Al pulsar Aceptar se abre ${nombreRed} — adjúntala a mano desde la descarga.`
			);
			if (!seguir) return;
			abrirRed(red, texto);
		});
	}

	function descargar() {
		conCanvas(async (canvas) => {
			const blob = await canvasABlob(canvas);
			if (!blob) return;
			descargarBlob(blob, nombreArchivo);
		});
	}

	function compartirNativo() {
		conCanvas((canvas) => exportarOCompartir(canvas, nombreArchivo, { title: etiqueta, text: texto }));
	}

	function onClickTrigger() {
		if (compartirNativoDisponible) {
			compartirNativo();
		} else {
			abierto = !abierto;
		}
	}

	function onBlur() {
		setTimeout(() => (abierto = false), 150);
	}
</script>

<div class="menu-compartir">
	<button
		type="button"
		class="trigger"
		class:primaria={variante === 'primaria'}
		disabled={generando}
		onclick={onClickTrigger}
		onblur={onBlur}
	>
		{generando ? 'Generando…' : etiqueta}
	</button>

	{#if abierto && !compartirNativoDisponible}
		<ul class="opciones">
			<li><button type="button" class="opcion" onmousedown={() => aRed('x')}>Compartir en X</button></li>
			<li><button type="button" class="opcion" onmousedown={() => aRed('whatsapp')}>Compartir en WhatsApp</button></li>
			<li><button type="button" class="opcion" onmousedown={descargar}>Descargar imagen</button></li>
		</ul>
	{/if}
</div>

<style>
	.menu-compartir {
		position: relative;
		display: inline-block;
	}

	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-body);
		cursor: pointer;
		white-space: nowrap;
	}

	.trigger:not(.primaria) {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
		background: var(--c);
		border: 1px solid var(--ink);
		padding: 7px 12px;
		transition: background 0.15s ease;
	}

	.trigger:not(.primaria):hover:not(:disabled) {
		background: var(--cd);
	}

	.trigger.primaria {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
		background: var(--c);
		border: 1px solid var(--ink);
		padding: 10px 20px;
		transition: background 0.15s ease;
	}

	.trigger.primaria:hover:not(:disabled) {
		background: var(--cd);
	}

	.trigger:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.trigger:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.opciones {
		position: absolute;
		z-index: 50;
		top: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		margin: 0;
		padding: 0;
		list-style: none;
		min-width: 190px;
		background: var(--paper);
		border: 1px solid var(--ink);
		box-shadow: var(--shadow-hard);
	}

	.opcion {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		padding: 9px 12px;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}

	.opciones li:last-child .opcion {
		border-bottom: none;
	}

	.opcion:hover {
		background: #fafafa;
	}
</style>
