// Fotos de líder por sigla. Compartido entre el simulador de pactos y el botón
// de compartir resultados de la home.
//
// **La clave tiene que ser la sigla exacta que publica el pipeline**, no el
// nombre con el que uno llama al partido: el mapa se consulta con
// `LIDERES[p.siglas]` y una diferencia de mayúsculas lo deja sin foto en
// silencio. Salen de `config/partidos.py` en elecciones-datos, y por eso aquí
// hay cosas como `B.N.G.` con puntos, `JxCAT - JUNTS` con espacios alrededor del
// guion o `PODEMOS` en mayúsculas — esta última estuvo escrita como "Podemos" y
// nunca llegó a enseñar la foto.
//
// Cada URL está comprobada con una petición HEAD (AGENTS.md: nunca inventar un
// avatar ni buscar la foto fuera de una fuente de confianza) — las once dan 200.
// Todas son de `live.staticflickr.com`, que manda `Access-Control-Allow-Origin`,
// así que además de salir en la UI pueden dibujarse en un `<canvas>` sin dejarlo
// "tainted": el bucket `s3transparentia` de Newtral no manda esa cabecera y
// rompía la imagen de compartir, por eso Feijóo y Sánchez se movieron a Flickr.
// Comprobado también con HEAD el 23/11/2026.
//
// Quien falte se resuelve solo: cualquier componente que use el mapa pinta un
// distintivo de color con la sigla cuando no hay foto.
export const LIDERES: Record<string, { nombre: string; foto: string }> = {
	PSOE: {
		nombre: 'Pedro Sánchez',
		foto: 'https://live.staticflickr.com/65535/55599113145_0c862ce7c6_t.jpg'
	},
	PP: {
		nombre: 'Alberto Núñez Feijóo',
		foto: 'https://live.staticflickr.com/65535/55597696582_a1af1a748c.jpg'
	},
	VOX: {
		nombre: 'Santiago Abascal',
		foto: 'https://live.staticflickr.com/65535/55598714331_8286c5b4cb_t.jpg'
	},
	// Frente Amplio es la marca del 29N; `SUMAR` es la misma candidata en los
	// datos de 23J, que el panel puede volver a leer con `FUENTE_DATOS`.
	FA: {
		nombre: 'Ada Colau',
		foto: 'https://live.staticflickr.com/65535/55598714326_0554aa72c2.jpg'
	},
	SUMAR: {
		nombre: 'Ada Colau',
		foto: 'https://live.staticflickr.com/65535/55598714326_0554aa72c2.jpg'
	},
	ERC: {
		nombre: 'Gabriel Rufián',
		foto: 'https://live.staticflickr.com/65535/55654860722_ba36d34fbc_t.jpg'
	},
	'JxCAT - JUNTS': {
		nombre: 'Míriam Nogueras',
		foto: 'https://live.staticflickr.com/65535/55655978073_80462cbab4_t.jpg'
	},
	'EH Bildu': {
		nombre: 'Oskar Matute',
		foto: 'https://live.staticflickr.com/65535/55656043549_d0b6595d44_t.jpg'
	},
	'EAJ-PNV': {
		nombre: 'Maribel Vaquero',
		foto: 'https://live.staticflickr.com/65535/55655978068_bd64938a61_t.jpg'
	},
	'B.N.G.': {
		nombre: 'Néstor Rego',
		foto: 'https://live.staticflickr.com/65535/55654860712_04719df68f_t.jpg'
	},
	PODEMOS: {
		nombre: 'Irene Montero',
		foto: 'https://live.staticflickr.com/65535/55598907244_3d57d2db05_t.jpg'
	},
	// La coalición de Nueva Canarias: la clave es la sigla que publica el
	// pipeline, con el "(+4)" que resume las cinco marcas de la candidatura.
	'NC-BC (+4)': {
		nombre: 'Luis Alberto Campos',
		foto: 'https://live.staticflickr.com/65535/55669500783_4388d16487_m.jpg'
	},
	// Compromís concurre en la agrupación 0077, que sigue sin decidir en
	// `config/partidos.py`: mientras esté ahí, el pipeline publica la sigla
	// literal del fichero del Ministerio, que es esta. Si se cataloga como marca
	// propia, hay que cambiar esta clave por la sigla que se le dé.
	'COMPROMIS-EUPV-PODEM-ERPV': {
		nombre: 'Àgueda Micó',
		foto: 'https://live.staticflickr.com/65535/55656265955_4c2b3579d1_t.jpg'
	}
};
