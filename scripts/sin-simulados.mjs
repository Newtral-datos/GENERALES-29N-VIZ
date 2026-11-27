#!/usr/bin/env node
/**
 * Saca `data-simulado/` de lo que se va a publicar.
 *
 * **El problema, que no se veía.** `DATOS_SIMULADOS` decide de qué carpeta LEE
 * el panel, y `comprobar-fuente.mjs` ya aborta el despliegue si está en `true`.
 * Pero la carpeta vive en `static/`, y el adaptador estático copia `static/`
 * entero al build: con el interruptor en `false` y el `predeploy` pasando en
 * verde, los 31 MB de datos de prueba se publicaban igual, en una URL pública y
 * adivinable (`/data-simulado/resultados29n.json`).
 *
 * No están enlazados desde ninguna parte, pero son un JSON con la forma exacta
 * de unos resultados, un 72 % de escrutinio y un reparto de escaños completo.
 * La noche electoral eso no puede estar colgado de la misma web que los
 * resultados de verdad.
 *
 * **Qué hace.** Borra `build/data-simulado/` después del build y antes de la
 * comprobación de fuente. Solo toca `build/`, que se regenera entero en cada
 * `npm run build`; `static/data-simulado/` no se toca nunca, que es donde el
 * pipeline deja lo no publicable y de donde lee el panel cuando se revisa en
 * local con el interruptor puesto.
 *
 * Se ejecuta solo:  node scripts/sin-simulados.mjs
 */

import { rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'build', 'data-simulado');

if (!existsSync(DESTINO)) {
	console.log('data-simulado: no está en el build, nada que quitar');
	process.exit(0);
}

// Cinturón: si alguna vez esto apuntara a `static/` por un cambio de rutas,
// mejor fallar que borrar la carpeta de trabajo del pipeline.
if (!DESTINO.includes(`${'build'}`) || DESTINO.includes(`${'static'}`)) {
	console.error(`No borro ${DESTINO}: solo se puede limpiar dentro de build/`);
	process.exit(1);
}

if (!statSync(DESTINO).isDirectory()) {
	console.error(`${DESTINO} no es una carpeta — no toco nada`);
	process.exit(1);
}

rmSync(DESTINO, { recursive: true, force: true });
console.log('data-simulado: fuera del build (no se publica)');
