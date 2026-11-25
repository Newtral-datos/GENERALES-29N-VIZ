// Intl's es-ES locale omite el punto de millar cuando solo hay un dígito antes
// del primer grupo (p. ej. 9500 -> "9500" en vez de "9.500"). Lo forzamos a mano.
export function formatMiles(n: number): string {
	return Math.round(n)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Cifras grandes en texto corrido: 10.491.447 -> "10,5 millones".
 *
 * Para cifras de contexto, no para datos que haya que comparar: ocho dígitos en
 * una nota al pie no se leen de un vistazo, y en esa posición nadie necesita la
 * unidad exacta. Por debajo del millón se devuelve el número con sus puntos de
 * millar, que a esa escala sí se lee.
 */
export function formatAprox(n: number): string {
	if (n < 1_000_000) return formatMiles(n);
	const millones = n / 1_000_000;
	// Un decimal hasta 100 millones; por encima, ninguno (no aporta nada).
	const cifra = millones >= 100 ? Math.round(millones).toString() : millones.toFixed(1);
	return `${cifra.replace('.', ',')} millones`;
}
