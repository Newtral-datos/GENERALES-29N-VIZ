# elecciones-panel

Proyecto de visualización de los resultados de las elecciones generales del 29 de noviembre.

## Arrancar

```bash
npm install
npm run dev       # servidor de desarrollo
npm run build     # build de producción
npm run preview   # sirve el build de producción
npm run check     # comprueba tipos con svelte-check
```

SvelteKit con TypeScript y `adapter-static`, desplegado en GitHub Pages.

No procesa datos: solo lee los JSON publicados por el repositorio `elecciones-datos`, que vive aparte para que quien trabaje con los datos no necesite Node ni acceso al panel, y para que actualizar resultados no obligue a volver a desplegar la web.

```
elecciones-panel/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   ├── ui/
│   │   │   └── layout/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── stores/
│   │   ├── actions/
│   │   ├── config/
│   │   ├── types/
│   │   └── styles/
│   └── routes/
│       └── [slug]/
├── static/
└── svelte.config.js
```

### src/routes/

Cada carpeta es una URL. `[slug]` es la ruta dinámica: cada convocatoria o vista tiene su propia página, que se puede embeber por separado. Aquí solo van las páginas y la carga de sus datos.

### src/lib/

Todo lo reutilizable. Se importa con el alias `$lib`.

- `components/`: componentes Svelte. `charts/` para gráficos (hemiciclo, barras, mapa), `ui/` para piezas de interfaz (tooltip, selector, leyenda) y `layout/` para cabecera, fuentes y notas.
- `services/`: las peticiones a los JSON de `elecciones-datos`. Va aparte de `utils` porque depende de la red y puede fallar.
- `utils/`: funciones puras: formato de números y porcentajes, escalas, cálculo de variaciones.
- `stores/`: estado compartido entre componentes, como el territorio seleccionado.
- `actions/`: funciones que se aplican a elementos con `use:` (detectar cuándo un gráfico entra en pantalla, clics fuera de un tooltip).
- `config/`: valores fijos del panel, como la URL base de los datos o los breakpoints.
- `types/`: tipos de TypeScript (resultado, partido, circunscripción).
- `styles/`: CSS compartido y variables.

### static/

Archivos que se sirven tal cual: favicon, imágenes, fuentes.

---

## Cómo se conecta con los datos

1. `elecciones-datos` ejecuta su pipeline y deja los JSON en su carpeta `public/`.
2. Esa carpeta se publica en GitHub Pages.
3. `elecciones-panel` descarga los JSON desde esa URL al cargar la página.

Los colores de los partidos viven en `elecciones-datos/config/` y se publican junto a los resultados, para que haya una sola versión.

## Credenciales

El panel es una web estática y todo lo que contiene es público, así que no debe llevar ninguna clave. Las credenciales solo se usan en `elecciones-datos`.
