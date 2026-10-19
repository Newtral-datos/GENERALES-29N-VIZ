// Fotos de líder por sigla. Se comprobó cada URL con un HEAD antes de usarla
// (ver AGENTS.md: nunca inventar avatar ni buscar foto fuera de una fuente de
// confianza). Las de Flickr (live.staticflickr.com) llevan cabecera
// Access-Control-Allow-Origin: *, así que además de salir en la UI pueden
// dibujarse en un <canvas> de "compartir" sin problema de tainted canvas —
// al contrario que el bucket s3transparentia (sin CORS), por eso
// Feijóo/Sánchez se han movido también a Flickr. Compartido entre el
// simulador de pactos y el botón de compartir resultados de la home.
//
// SUMAR ahora se presenta como "Frente Amplio" con Ada Colau — el dato sigue
// llegando con siglas:"SUMAR" en el JSON (23J de prueba), así que la clave
// aquí tiene que seguir siendo esa para que se recoja; el nombre visible de
// la marca es cosa del pipeline de datos, no de este mapa. "Podemos" no
// tiene fila propia todavía en nacional.partidos (en los datos de prueba de
// 23J va dentro de SUMAR) — se deja ya cargada para cuando la convocatoria
// real sí la traiga desglosada. El resto se deja en blanco hasta tener URL
// confirmada; no hace falta tocar nada más, cualquier componente que la use
// ya resuelve el líder que falte con un hueco vacío.
export const LIDERES: Record<string, { nombre: string; foto: string }> = {
	PP: {
		nombre: 'Alberto Núñez Feijóo',
		foto: 'https://live.staticflickr.com/65535/55597696582_a1af1a748c.jpg'
	},
	PSOE: {
		nombre: 'Pedro Sánchez',
		foto: 'https://live.staticflickr.com/65535/55599113145_0c862ce7c6_t.jpg'
	},
	VOX: {
		nombre: 'Santiago Abascal',
		foto: 'https://live.staticflickr.com/65535/55598714331_8286c5b4cb_t.jpg'
	},
	SUMAR: {
		nombre: 'Ada Colau',
		foto: 'https://live.staticflickr.com/65535/55598714326_0554aa72c2.jpg'
	},
	Podemos: {
		nombre: 'Irene Montero',
		foto: 'https://live.staticflickr.com/65535/55598907244_3d57d2db05_t.jpg'
	}
};
