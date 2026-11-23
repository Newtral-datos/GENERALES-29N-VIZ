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

const ESPERADOS = {
	'23j': ['resultados23j.json', 'participacion23j.json', 'resultadosSenado23j.json'],
	'29n': ['resultados29n.json', 'participacion29n.json', 'resultadosSenado29n.json']
};

// Comunes a las dos convocatorias. `indice-municipios.json` está aquí porque se
// escapó de la primera versión de esta comprobación: faltaba, el deploy pasó, y
// el buscador de municipios quedó publicado con un 404 en consola. Lo que no se
// comprueba, no está.
const COMUNES = [
	'indice-municipios.json',
	'ccaa-provincias.json',
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
const CARPETA_MUNICIPIOS = { '23j': 'resultados-municipios', '29n': 'resultados-municipios-29n' };
// La participación municipal solo existe para el 29N (sale de los ficheros
// `avances-municipios-*` de la jornada, que no tienen equivalente en 23J).
const CARPETA_PARTICIPACION_MUNICIPIOS = 'participacion-municipios-29n';

const faltan = [...ESPERADOS[fuente], ...COMUNES].filter((f) => !existsSync(join(DATA, f)));

const dirMunicipios = join(DATA, CARPETA_MUNICIPIOS[fuente]);
let avisoMunicipios = null;
if (!existsSync(dirMunicipios)) {
	faltan.push(`${CARPETA_MUNICIPIOS[fuente]}/`);
} else {
	const n = readdirSync(dirMunicipios).filter((f) => f.endsWith('.json')).length;
	// 52 provincias. Menos no es necesariamente un error durante la jornada (el
	// Ministerio publica por ámbitos), pero conviene verlo antes de publicar.
	if (n < 52) avisoMunicipios = `${CARPETA_MUNICIPIOS[fuente]}/ tiene ${n} de 52 provincias`;
}

console.log(`FUENTE_DATOS = '${fuente}'`);

if (faltan.length) {
	console.error(`\nFaltan en static/data/ los datos que pide esa fuente:`);
	for (const f of faltan) console.error(`  - ${f}`);
	console.error(
		`\nEl panel se desplegaría con la portada vacía y 404 en consola.\n` +
			(fuente === '29n'
				? 'Lánzalo primero: cd ../elecciones-datos && ./scripts/actualizar_29n.sh\n' +
					'(sin --pruebas: con ese flag los JSON van a salida-no-publicable/, no al panel)'
				: 'Los JSON de 23J los generan los scripts de pipeline/procesado/historico/.')
	);
	process.exit(1);
}

const dirPartMuni = join(DATA, CARPETA_PARTICIPACION_MUNICIPIOS);
if (!existsSync(dirPartMuni)) {
	console.error(
		`\nFalta static/data/${CARPETA_PARTICIPACION_MUNICIPIOS}/ — el mapa municipal de /participacion\n` +
			'se quedaría sin datos. Lo genera pipeline.procesado.participacion_29n_municipios.'
	);
	process.exit(1);
}

if (avisoMunicipios) console.warn(`  aviso: ${avisoMunicipios}`);
console.log('  los datos de esa fuente están completos en static/data/');
