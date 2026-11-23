// Interruptor manual para la noche del 29N: antes de que empiece el
// escrutinio y toda la visualización esté pública, se ocultan las pestañas
// Congreso/Senado (ChamberTabs, en +layout.svelte), el % de escrutinio del
// faldón de cabecera (EscrutinioHeader — el resto del faldón, logo y "En
// directo" incluidos, se queda visible), y el acceso de vuelta a Congreso
// desde Participación (ParticipacionView.svelte). Cambiar a `true` cuando
// arranque la jornada electoral y volver a desplegar — no hay lógica de
// fecha/hora automática, es manual a propósito.
export const ESCRUTINIO_ABIERTO = true;

/**
 * Qué sello de tiempo enseña el faldón mientras no hay datos de la jornada.
 *
 * Es un valor puesto a mano a propósito, igual que `ESCRUTINIO_ABIERTO`: hasta
 * el 29N el panel anuncia la cita, no un dato. En cuanto el pipeline publica un
 * JSON con `fecha` y `horaTotalizacion`, manda el fichero y esto deja de usarse
 * — no hay que volver a tocarlo.
 *
 * Aquí había antes un `ESCRUTINIO_SIMULADO = 92.3` que el faldón enseñaba como
 * porcentaje escrutado cuando faltaban los datos. Iba rotulado "(simulado)",
 * pero un 92,3 % en la cabecera de un panel electoral es una cifra que se lee
 * de un vistazo y el rótulo no: antes del escrutinio lo escrutado es 0, y eso
 * es lo que se enseña.
 */
export const SELLO_PREVIO = { fecha: '2026-11-29', hora: '00:00' };

/**
 * De qué convocatoria lee los datos el panel.
 *
 * - `'23j'`: julio de 2023, el contenido de prueba con el que se ha construido
 *   todo. Es lo que hay publicado mientras el 29N no haya empezado.
 * - `'29n'`: los JSON que escribe el pipeline de `elecciones-datos` cada vez
 *   que se lanza `./scripts/actualizar_29n.sh`.
 *
 * **Manual a propósito, igual que `ESCRUTINIO_ABIERTO`.** Dos razones para no
 * automatizarlo:
 *
 * 1. Nada de calcularlo por fecha: el reloj del navegador de cada visitante no
 *    es de fiar, y la frontera es una decisión editorial, no un instante.
 * 2. Nada de "usa el del 29N si el fichero existe". Un `fetch` que cae al de
 *    23J cuando el del 29N da 404 publica datos de otra convocatoria con
 *    apariencia de actuales, y podría cambiar de fuente a mitad de la noche si
 *    una petición falla. Si falta el fichero que toca, es mejor que se vea.
 *
 * Cambiar a `'29n'` y volver a desplegar es el propio mecanismo de "pasar a
 * datos reales". Ojo: esto NO abre el panel, eso es `ESCRUTINIO_ABIERTO`; son
 * dos interruptores independientes porque responden a dos preguntas distintas
 * (qué datos se leen / qué partes se enseñan).
 */
export const FUENTE_DATOS: '23j' | '29n' = '29n';

/**
 * Cómo se nombran las dos convocatorias en los textos de la UI.
 *
 * Estaban escritas a mano en seis sitios ("— 23J", "respecto a 2019") y se
 * quedaron desfasadas en cuanto el panel pasó a leer datos del 29N: las notas
 * de los tres mapas seguían diciendo 23J, y el delta de participación decía
 * "respecto a 2019" cuando compara con julio de 2023. Un rótulo equivocado al
 * pie de un mapa es tan falso como una cifra equivocada.
 *
 * `ANTERIOR` tiene que cuadrar con lo que el pipeline pone en
 * `anterior.etiqueta` de los JSON (ver `_comun_29n`).
 */
export const CONVOCATORIA = '29N';
export const CONVOCATORIA_ANTERIOR = '23J';
