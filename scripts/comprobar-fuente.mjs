#!/usr/bin/env node
/**
 * ¿Están en `static/data/` los ficheros que pide `FUENTE_DATOS`?
 *
 * La conmutación entre convocatorias es un cambio de ruta en `data.ts`, y los
 * `fetch` son en tiempo de ejecución: si `FUENTE_DATOS` es `'29n'` pero el
 * pipeline no ha dejado los JSON del 29N, ni `npm run build` ni `npm run check`
 * se quejan — el panel se despliega y falla en el navegador del visitante, con
 * la portada vacía y 404 en la consola. Y al contrario: con `'23j'` seleccionado
 * da igual que los del 29N estén o no.
 *
 * Por eso esto corre en `predeploy`, después del build: es la última ocasión de
 * enterarse antes de publicar.
 *
 * Se ejecuta solo:  node scripts/comprobar-fuente.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(RAIZ, 'static', 'data');

// Se lee el .ts como texto a propósito: importarlo obligaría a compilar y a
// arrastrar el resto del módulo solo para leer una constante.
const config = readFileSync(join(RAIZ, 'src', 'lib', 'config.ts'), 'utf8');
const fuente = config.match(/FUENTE_DATOS[^=]*=\s*'(23j|29n)'/)?.[1];

if (!fuente) {
	console.error('No encuentro FUENTE_DATOS en src/lib/config.ts — ¿se ha renombrado?');
	process.exit(1);
}

// `DATOS_SIMULADOS` apunta el panel a `static/data-simulado/`, que es donde el
// pipeline deja lo que NO es publicable: el snapshot de prueba generado desde
// 23J y los del rodaje y el simulacro. Desplegar con eso activado publicaría
// cifras que no son resultados con toda la apariencia de serlo, que es
// exactamente lo que pasó el 23/11 sin que nada avisara. Así que aquí no se
// avisa: se para.
const simulados = config.match(/DATOS_SIMULADOS[^=]*=\s*(true|false)/)?.[1];

if (!simulados) {
	console.error('No encuentro DATOS_SIMULADOS en src/lib/config.ts — ¿se ha renombrado?');
	process.exit(1);
}

if (simulados === 'true') {
	console.error('\nDATOS_SIMULADOS está en `true`: el panel lee de static/data-simulado/.');
	console.error('Esa carpeta lleva datos que NO son resultados (snapshot de prueba,');
	console.error('rodaje o simulacro). Ponlo en `false` antes de desplegar.');
	process.exit(1);
}

// Dos grupos, y el trato es distinto porque el riesgo es distinto.
//
// **Del repo**: geometría y tablas fijas. No las escribe ningún script del
// pipeline, así que si falta una es que alguien la ha borrado. Aborta siempre.
const DEL_REPO = [
	'ccaa-provincias.json',
	// Índice del buscador de municipios. Es estructura —nombre, provincia y
	// código INE— y no resultados, así que está versionado y tiene que existir
	// también sin datos de la jornada: si falta, el buscador no devuelve nada y
	// no hay ningún error visible. Lo genera
	// `elecciones-datos/scripts/generar_indice_municipios.py`.
	'indice-municipios.json',
	'escanos-congreso-provincias.json',
	'provincias.geojson',
	// Geometría del nivel de comunidad: es la vista por defecto del mapa de la
	// home y faltaba en esta lista.
	'ccaa.geojson',
	// Composición de la convocatoria anterior. Es dato fijo y además el respaldo
	// del panel cuando todavía no hay escrutinio: sin estos dos, a las 20:00 del
	// 29N la tabla y el hemiciclo salen vacíos. Los genera
	// pipeline/procesado/anterior_29n.py.
	'anterior-congreso.json',
	'anterior-senado.json'
];

// **De la jornada**: lo que regenera el pipeline en cada vuelta.
//
// `indice-municipios.json` está aquí porque se escapó de la primera versión de
// esta comprobación: faltaba, el deploy pasó, y el buscador de municipios quedó
// publicado con un 404 en consola. Lo que no se comprueba, no está.
const DE_LA_JORNADA = {
	'23j': [
		'resultados23j.json',
		'participacion23j.json',
		'resultadosSenado23j.json',
		'resultados-municipios/',
		'participacion-municipios-29n/'
	],
	'29n': [
		'resultados29n.json',
		'participacion29n.json',
		'resultadosSenado29n.json',
		'resultados-municipios-29n/',
		// La participación municipal solo existe para el 29N (sale de los
		// ficheros `avances-municipios-*` de la jornada, que no tienen
		// equivalente en 23J).
		'participacion-municipios-29n/'
	]
};

// Cuál de esas carpetas debería tener 52 provincias.
const CARPETA_MUNICIPIOS = { '23j': 'resultados-municipios/', '29n': 'resultados-municipios-29n/' };

const faltanRepo = DEL_REPO.filter((f) => !existsSync(join(DATA, f)));
const jornada = DE_LA_JORNADA[fuente];
const faltanJornada = jornada.filter((f) => !existsSync(join(DATA, f.replace(/\/$/, ''))));

console.log(`FUENTE_DATOS = '${fuente}'`);

if (faltanRepo.length) {
	console.error('\nFaltan ficheros que NO genera el pipeline, así que alguien los ha borrado:');
	for (const f of faltanRepo) console.error(`  - ${f}`);
	console.error('\nLos dos `anterior-*.json` los regenera `python3 -m pipeline.procesado.anterior_29n`.');
	console.error('La geometría y las tablas fijas están versionadas: `git checkout -- static/data`.');
	process.exit(1);
}

// **Ausentes TODOS: es el estado vacío, y es un estado válido.**
//
// El panel está construido a propósito para verse sin datos de la jornada: el
// getter devuelve un juego vacío bien formado, la tabla y el hemiciclo enseñan
// la Cámara saliente desde los `anterior-*.json` y los mapas van al gris de "sin
// escrutar". Es lo que hay que publicar antes de que empiece el escrutinio, así
// que esto no puede abortar — antes lo hacía, y dejaba el panel previo sin poder
// desplegarse.
//
// **Ausentes ALGUNOS: eso sí aborta.** Es el caso peligroso de verdad: una
// vuelta del pipeline a medias, o una receta de limpieza que se dejó ficheros
// por el camino, publica una mezcla de datos nuevos y viejos. Que es
// exactamente el fallo que llevó a escribir esta comprobación.
if (faltanJornada.length === jornada.length) {
	console.warn('\n  ⚠ SIN DATOS DE LA JORNADA — se despliega el panel previo.');
	console.warn('    La tabla y el hemiciclo enseñarán la Cámara saliente, y los mapas');
	console.warn('    saldrán en el gris de "sin escrutar". Es el estado correcto antes de');
	console.warn('    que empiece el escrutinio.');
	console.warn('    Si esto NO es lo que querías, lanza el pipeline antes de desplegar:');
	console.warn('      cd ../elecciones-datos && ./scripts/actualizar_29n.sh');
	process.exit(0);
}

if (faltanJornada.length) {
	console.error('\nFaltan SOLO ALGUNOS de los datos de la jornada:');
	for (const f of faltanJornada) console.error(`  - ${f}`);
	console.error(
		'\nEso publica una mezcla: unas piezas con datos y otras vacías, o peor, con\n' +
			'los de la vuelta anterior. O se completa la vuelta, o se vacía del todo\n' +
			'(receta en ESTADO.md, "Volver al punto de partida").\n' +
			(fuente === '29n'
				? 'Completar: cd ../elecciones-datos && ./scripts/actualizar_29n.sh\n' +
					'(sin --pruebas: con ese flag los JSON van a static/data-simulado/, no al panel)'
				: 'Los JSON de 23J los generan los scripts de pipeline/procesado/historico/.')
	);
	process.exit(1);
}

// Con todo presente, el único aviso que queda es de completitud.
const dirMunicipios = join(DATA, CARPETA_MUNICIPIOS[fuente].replace(/\/$/, ''));
const n = readdirSync(dirMunicipios).filter((f) => f.endsWith('.json')).length;
// 52 provincias. Menos no es necesariamente un error durante la jornada (el
// Ministerio publica por ámbitos), pero conviene verlo antes de publicar.
if (n < 52) console.warn(`  aviso: ${CARPETA_MUNICIPIOS[fuente]} tiene ${n} de 52 provincias`);

console.log('  los datos de esa fuente están completos en static/data/');
