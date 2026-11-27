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
 * Cada cuántos minutos se resalta el botón de "Actualizar" del faldón.
 *
 * El panel pide los JSON una sola vez, al cargar: quien deje la pestaña abierta
 * se queda congelado en el envío que hubiera entonces. Esto es el aviso de que
 * conviene recargar, y va **por reloj**, al ritmo con el que se despliega la
 * noche electoral (3-4 min). Que sea por reloj significa que a veces pedirá
 * recargar para ver lo mismo —si una vuelta no trajo envío nuevo—, y por eso el
 * botón dice "Actualizar" y no "hay datos nuevos": avisa de que el dato que se
 * está mirando tiene ya unos minutos, que es lo único que sabe de verdad.
 */
export const MINUTOS_PARA_AVISAR = 4;

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
 * Lee los JSON de `static/data-simulado/` en vez de `static/data/`.
 *
 * Es para trabajar en local antes de que el servicio del Ministerio sirva
 * envíos con contenido: `elecciones-datos/scripts/simular_desde_23j.py` genera
 * un snapshot de prueba a partir de los resultados reales de 23J (marcas,
 * colores y geografía de verdad, cifras movidas), y el procesado lo escribe en
 * esa carpeta porque su `meta.json` lleva `simulado: true` — ver
 * `_comun_29n.salida()`. Lo mismo vale para los snapshots marcados `pruebas`:
 * el rodaje previo y el simulacro, que vienen del endpoint real pero no son
 * resultados.
 *
 * **Ortogonal a `FUENTE_DATOS` a propósito.** Esta constante dice de qué
 * CARPETA se lee; `FUENTE_DATOS`, de qué CONVOCATORIA. Los nombres de fichero
 * dentro de `data-simulado/` son los mismos, así que el panel entero funciona
 * igual sin que ningún componente sepa de esto.
 *
 * **El `predeploy` se niega a construir con esto en `true`.** Es la red que
 * faltaba: el 23/11 un snapshot de rodaje acabó publicado en el panel como si
 * fueran resultados porque no se bajó con `--pruebas`, y nada lo impidió. La
 * geometría y las tablas fijas siguen leyéndose de `static/data/`, que es donde
 * las deja el repo: esta carpeta solo lleva lo que regenera el pipeline.
 */
export const DATOS_SIMULADOS = false;

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

/**
 * A partir de qué % escrutado **de una provincia** su batalla por el último
 * escaño se puede clasificar.
 *
 * El dato que publica el Ministerio —cuántos votos le faltan al segundo para
 * quitarle el último escaño al primero— es correcto en cada envío, pero al
 * principio de la noche no dice lo que parece: con el 39 % escrutado quedan
 * 22 millones de electores por contar, así que **cualquier** diferencia cabe
 * en lo que falta y las 52 provincias salen "en disputa". Medido con datos
 * reales: ni bajando el umbral al 1 % de lo pendiente se filtraba nada
 * razonable, seguían quedando 23 provincias.
 *
 * **Se compara contra el escrutinio de cada provincia, no contra el nacional**,
 * y eso es lo que se corrigió el 26/11. El Ministerio no reparte el escrutinio
 * de forma uniforme: **cierra provincia por provincia**. Medido en los
 * snapshots del simulacro del 25/11, con el 51,86 % nacional había ya 27 de 52
 * provincias al 100 % —y con el 45,24 %, 26 al 100 % con Madrid todavía a 0—.
 * Así que el porcentaje nacional no dice nada del estado de una provincia
 * concreta: con él, provincias ya cerradas se contaban como "en disputa" y
 * provincias casi sin contar se colaban en la cabeza del ranking con la
 * proporción más baja de las 52, precisamente por no haber contado nada.
 *
 * Las que no llegan al umbral no se clasifican ni en un sentido ni en otro:
 * van al final de la lista, en gris en el mapa y con su propio corte y su
 * propio texto, distinto del de las decididas.
 *
 * **Es un número a mano y a propósito**, para poder moverlo la propia noche
 * electoral sin tocar lógica: si a las 23:00 se ve que el ranking se ha
 * estabilizado antes, se baja y se despliega.
 */
export const ESCRUTINIO_BATALLA_FIABLE = 20;
