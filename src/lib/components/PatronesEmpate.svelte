<script lang="ts">
	import { patronesDe, type Ganador } from '#lib/empates';

	/**
	 * Los `<pattern>` de rayas que necesitan los mapas para pintar los empates.
	 *
	 * Va dentro del `<svg>` del mapa, al principio: un `<pattern>` solo lo puede
	 * referenciar el SVG donde está declarado, así que no sirve ponerlo una vez
	 * en el layout.
	 *
	 * Las rayas van en los colores de los partidos empatados (dos o más), con un
	 * filete neutro entre medias: los colores claros del catálogo —EH Bildu
	 * `#A4CE4E`, ERC `#FFB400`— se quedan en ~1,7:1 contra el papel y dos de
	 * ellos juntos serían ilegibles sin separación. Es la misma compensación que
	 * pide el AGENTS.md para las marcas pequeñas.
	 */
	let { ganadores }: { ganadores: (Ganador | null | undefined)[] } = $props();

	let patrones = $derived(patronesDe(ganadores));
	const ANCHO = 5;
</script>

{#each patrones as { id, colores } (id)}
	<pattern
		{id}
		width={ANCHO * colores.length}
		height={ANCHO * colores.length}
		patternUnits="userSpaceOnUse"
		patternTransform="rotate(45)"
	>
		{#each colores as color, i (color + i)}
			<rect x={i * ANCHO} y="0" width={ANCHO} height={ANCHO * colores.length} fill={color} />
			<rect x={i * ANCHO + ANCHO - 0.6} y="0" width="0.6" height={ANCHO * colores.length} fill="#fff" opacity="0.65" />
		{/each}
	</pattern>
{/each}
