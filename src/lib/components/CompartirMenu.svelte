<script lang="ts">
	import {
		canvasABlob,
		compartirARed,
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
	let mensaje = $state('');

	// navigator.share con ficheros solo tiene soporte fiable en móvil — en
	// Chrome/Safari de escritorio normalmente no existe, así que esa opción
	// extra solo se ofrece cuando el propio navegador dice que puede.
	let compartirNativoDisponible = $state(false);
	$effect(() => {
		const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
		compartirNativoDisponible = typeof nav.canShare === 'function';
	});

	function avisar(texto: string) {
		mensaje = texto;
		setTimeout(() => {
			if (mensaje === texto) mensaje = '';
		}, 4000);
	}

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

	function aRed(red: RedSocial) {
		conCanvas(async (canvas) => {
			const blob = await canvasABlob(canvas);
			if (!blob) return;
			const { copiada } = await compartirARed(red, { blob, nombreArchivo, texto });
			avisar(
				copiada
					? 'Imagen copiada — pégala con ⌘V / Ctrl+V en la ventana que se acaba de abrir.'
					: 'Se ha descargado la imagen — adjúntala a mano en la ventana que se acaba de abrir.'
			);
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
		onclick={() => (abierto = !abierto)}
		onblur={onBlur}
	>
		{generando ? 'Generando…' : etiqueta}
	</button>

	{#if abierto}
		<ul class="opciones">
			<li><button type="button" class="opcion" onmousedown={() => aRed('x')}>Compartir en X</button></li>
			<li><button type="button" class="opcion" onmousedown={() => aRed('whatsapp')}>Compartir en WhatsApp</button></li>
			{#if compartirNativoDisponible}
				<li><button type="button" class="opcion" onmousedown={compartirNativo}>Más opciones…</button></li>
			{/if}
			<li><button type="button" class="opcion" onmousedown={descargar}>Descargar imagen</button></li>
		</ul>
	{/if}

	{#if mensaje}
		<p class="aviso">{mensaje}</p>
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

	.aviso {
		position: absolute;
		top: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 50;
		width: max-content;
		max-width: 260px;
		margin: 0;
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-body);
		font-size: 11px;
		line-height: 1.4;
		padding: 8px 10px;
		text-align: center;
	}
</style>
