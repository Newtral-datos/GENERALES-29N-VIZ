// Interruptor manual para la noche del 29N: antes de que empiece el
// escrutinio y toda la visualización esté pública, se ocultan las pestañas
// Congreso/Senado (ChamberTabs, en +layout.svelte), el % de escrutinio del
// faldón de cabecera (EscrutinioHeader — el resto del faldón, logo y "En
// directo" incluidos, se queda visible), y el acceso de vuelta a Congreso
// desde Participación (ParticipacionView.svelte). Cambiar a `true` cuando
// arranque la jornada electoral y volver a desplegar — no hay lógica de
// fecha/hora automática, es manual a propósito.
export const ESCRUTINIO_ABIERTO = true;
