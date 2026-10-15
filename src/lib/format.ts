// Intl's es-ES locale omite el punto de millar cuando solo hay un dígito antes
// del primer grupo (p. ej. 9500 -> "9500" en vez de "9.500"). Lo forzamos a mano.
export function formatMiles(n: number): string {
	return Math.round(n)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
