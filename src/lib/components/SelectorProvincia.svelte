<script lang="ts">
	/**
	 * Elegir provincia: input con buscador y lista propia, no un `<select>`.
	 *
	 * Un `<select>` nativo con 52 opciones es inusable cerca del pie de página:
	 * el menú lo dibuja el sistema operativo, que intenta alinear la opción
	 * seleccionada con la caja, y con el marcador en la primera posición de una
	 * lista tan larga el desplegable se va fuera de la pantalla. No hay CSS que
	 * lo arregle — ese menú no es de la página.
	 *
	 * Con una lista propia la posición la controlamos nosotros, y de paso se
	 * puede escribir para filtrar, que con 52 provincias es más rápido que
	 * buscar a ojo. Es el mismo patrón que ya usa el buscador de municipios del
	 * mapa de la home.
	 */
	import { tick } from 'svelte';

	let {
		provincias,
		cod = $bindable(''),
		etiqueta = 'Provincia',
		placeholder = 'Elige una provincia…'
	}: {
		provincias: Record<string, { nombre: string }> | null;
		cod?: string;
		etiqueta?: string;
		placeholder?: string;
	} = $props();

	let busqueda = $state('');
	let abierto = $state(false);
	let resaltado = $state(0);
	let input = $state<HTMLInputElement | null>(null);
	let caja = $state<HTMLDivElement | null>(null);
	// La lista se despliega hacia arriba cuando no cabe debajo. Es el mismo
	// criterio que los popups de los mapas (AGENTS.md): voltear al lado
	// contrario, nunca recortar contra el borde. Sin esto, con el selector cerca
	// del pie de página la lista se salía 110 px por abajo.
	let haciaArriba = $state(false);

	const ALTO_LISTA = 222; // max-height 220 + borde

	function medirHueco() {
		if (!caja) return;
		const r = caja.getBoundingClientRect();
		const debajo = window.innerHeight - r.bottom;
		const encima = r.top;
		haciaArriba = debajo < ALTO_LISTA && encima > debajo;
	}

	function abrir() {
		medirHueco();
		abierto = true;
	}

	function normalizar(s: string): string {
		// Sin acentos y en minúsculas: "coruna" tiene que encontrar "A Coruña",
		// y "alava" tiene que encontrar "Araba/Álava".
		return s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	let lista = $derived(
		Object.entries(provincias ?? {})
			.map(([c, p]) => ({ cod: c, nombre: p.nombre }))
			.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
	);

	let filtradas = $derived.by(() => {
		const q = normalizar(busqueda.trim());
		if (!q) return lista;
		return lista.filter((p) => normalizar(p.nombre).includes(q));
	});

	let nombreElegido = $derived(cod ? (provincias?.[cod]?.nombre ?? '') : '');

	function elegir(c: string) {
		cod = c;
		busqueda = '';
		abierto = false;
		input?.blur();
	}

	function limpiar() {
		cod = '';
		busqueda = '';
		abierto = false;
	}

	function onBlur() {
		// Margen para que el clic en un elemento de la lista llegue antes de que
		// el blur la cierre.
		setTimeout(() => (abierto = false), 150);
	}

	async function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			abierto = false;
			return;
		}
		if (!abierto && (e.key === 'ArrowDown' || e.key === 'Enter')) {
			abrir();
			await tick();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			resaltado = Math.min(resaltado + 1, filtradas.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			resaltado = Math.max(resaltado - 1, 0);
		} else if (e.key === 'Enter' && filtradas[resaltado]) {
			e.preventDefault();
			elegir(filtradas[resaltado].cod);
		}
	}

	// Al escribir, el resaltado vuelve arriba: si no, se queda apuntando a una
	// posición que ya no existe en la lista filtrada.
	$effect(() => {
		busqueda;
		resaltado = 0;
	});
</script>

<div class="fila">
	<span class="etiqueta">{etiqueta}</span>

	<div class="caja" bind:this={caja}>
		<input
			bind:this={input}
			bind:value={busqueda}
			type="text"
			class="entrada"
			placeholder={nombreElegido || placeholder}
			class:elegida={!!nombreElegido}
			autocomplete="off"
			role="combobox"
			aria-expanded={abierto}
			aria-controls="lista-provincias"
			aria-label={etiqueta}
			onfocus={abrir}
			onblur={onBlur}
			onkeydown={onKeydown}
		/>

		{#if nombreElegido}
			<button type="button" class="limpiar" onclick={limpiar} aria-label="Quitar la provincia elegida">
				×
			</button>
		{/if}

		{#if abierto && filtradas.length}
			<!-- La lista es de la página, así que su posición y su alto los
			     decidimos aquí: nunca se sale de la pantalla. -->
			<ul class="lista" class:arriba={haciaArriba} id="lista-provincias" role="listbox">
				{#each filtradas as p, i (p.cod)}
					<li>
						<button
							type="button"
							class="opcion"
							class:resaltada={i === resaltado}
							class:activa={p.cod === cod}
							role="option"
							aria-selected={p.cod === cod}
							onmousedown={() => elegir(p.cod)}
							onmouseenter={() => (resaltado = i)}
						>
							{p.nombre}
						</button>
					</li>
				{/each}
			</ul>
		{:else if abierto}
			<ul class="lista" class:arriba={haciaArriba} id="lista-provincias" role="listbox">
				<li class="vacia">Ninguna provincia coincide</li>
			</ul>
		{/if}
	</div>
</div>

<style>
	.fila {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	.etiqueta {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.caja {
		position: relative;
		width: 200px;
	}

	.entrada {
		width: 100%;
		padding: 6px 24px 6px 8px;
		font: inherit;
		font-size: 11px;
		color: var(--ink, #0a0e14);
		background: #fff;
		border: 1px solid #e5e7eb;
		/* Esquinas rectas, como el resto de cards del workspace. */
		border-radius: 0;
	}

	.entrada:focus {
		outline: none;
		border-color: var(--cd, #00b38a);
	}

	.entrada.elegida::placeholder {
		color: var(--ink, #0a0e14);
		opacity: 1;
	}

	.limpiar {
		position: absolute;
		top: 50%;
		right: 4px;
		transform: translateY(-50%);
		padding: 0 4px;
		border: 0;
		background: none;
		font-size: 14px;
		line-height: 1;
		color: #9ca3af;
		cursor: pointer;
	}

	.limpiar:hover {
		color: var(--ink, #0a0e14);
	}

	.lista {
		position: absolute;
		z-index: 50;
		top: calc(100% + 2px);
		left: 0;
		right: 0;
		/* Alto acotado: con 52 provincias, una lista sin tope volvería a salirse
		   por abajo, que es justo el problema del select nativo. */
		max-height: 220px;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		background: #fff;
		border: 1px solid #e5e7eb;
		box-shadow: var(--shadow-hard, 2px 2px 0 rgba(10, 14, 20, 0.15));
	}

	.lista.arriba {
		top: auto;
		bottom: calc(100% + 2px);
	}

	.opcion {
		display: block;
		width: 100%;
		padding: 5px 8px;
		border: 0;
		background: none;
		font: inherit;
		font-size: 11px;
		text-align: left;
		color: var(--ink, #0a0e14);
		cursor: pointer;
	}

	.opcion.resaltada {
		background: #f3f4f6;
	}

	.opcion.activa {
		font-weight: 700;
	}

	.vacia {
		padding: 8px;
		font-size: 11px;
		font-style: italic;
		color: #9ca3af;
	}

	@media (max-width: 640px) {
		.caja {
			width: 160px;
		}
	}
</style>
