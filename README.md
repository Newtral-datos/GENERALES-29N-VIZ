# elecciones-panel

Panel de visualización de resultados de las Elecciones Generales del 29 de noviembre (Congreso de los Diputados y Senado). SvelteKit + TypeScript, desplegado como sitio estático en GitHub Pages.

> Normas de marca y convenciones compartidas con el resto de paneles de Newtral: ver `AGENTS.md` en la raíz de `ELECCIONES/`. Este README solo cubre lo específico de este proyecto.

## Arrancar

```bash
npm install
npm run dev       # servidor de desarrollo
npm run build     # build de producción (adapter-static → carpeta build/)
npm run preview   # sirve el build de producción
npm run check     # comprueba tipos con svelte-check
npm run deploy    # build + publica build/ en la rama gh-pages
```

## Estado actual

Toda la vista de **Congreso** está construida con los resultados de las Generales del 23 de julio de 2023 como datos de referencia (no son los del 29N — todavía no existen). Está marcado como tal en el propio código (`// TODO` + "datos simulados"/"23J" en la UI) para que no se confunda con un resultado real. La vista de **Senado** es un marcador de posición: se construirá cuando empiecen a llegar simulacros de datos de esa cámara.

## Estructura real

```
elecciones-panel/
├── src/
│   ├── app.css                      # tokens de diseño (color, tipografía, bordes) + estilos base
│   ├── app.html / app.d.ts
│   ├── lib/
│   │   ├── data.ts                  # fetch + caché en memoria de static/data/resultados23j.json, tipos
│   │   ├── assets/favicon.svg
│   │   └── components/              # un componente = un archivo, sin subcarpetas por tipo
│   │       ├── EscrutinioHeader.svelte   # cabecera fija: % escrutado simulado, animado
│   │       ├── ChamberTabs.svelte        # pestañas Congreso / Senado (navegación real, no estado)
│   │       ├── CongresoView.svelte       # vista de la ruta "/": barra + grid (tabla/hemiciclo/mapa)
│   │       ├── SenadoView.svelte         # vista de la ruta "/senado": marcador de posición
│   │       ├── BarraEscanos.svelte       # barra apilada horizontal de escaños
│   │       ├── Hemiciclo.svelte          # hemiciclo SVG (anillo actual + anillo "anterior" simulado)
│   │       ├── TablaPartidos.svelte      # tabla de resultados por partido
│   │       └── MapaProvincias.svelte     # mapa coroplético por provincia + popup hover
│   └── routes/
│       ├── +layout.svelte           # monta EscrutinioHeader + ChamberTabs + la vista de cada ruta
│       ├── +layout.ts               # export const prerender = true (requisito de adapter-static)
│       ├── +page.svelte             # ruta "/" → Congreso
│       └── senado/+page.svelte      # ruta "/senado" → Senado
├── static/
│   ├── .nojekyll                    # ver nota de despliegue más abajo
│   ├── robots.txt
│   └── data/
│       ├── resultados23j.json       # resultados nacionales + por circunscripción (23J, histórico)
│       └── provincias.geojson       # geometría de las 52 provincias, simplificada con mapshaper (~75KB)
├── vite.config.ts                   # sveltekit() con adapter-static + paths.base condicional
└── package.json
```

No hay carpetas `charts/`, `ui/`, `layout/`, `services/`, `stores/`, `actions/`, `config/`, `types/` ni `styles/` — con ocho componentes y un único módulo de datos, esa subdivisión sería prematura (ver "no crear abstracciones hasta que haga falta" en `AGENTS.md`). Si el panel crece mucho, se revisa entonces.

## Rutas

| Ruta | Vista | Contenido |
|---|---|---|
| `/` | `CongresoView.svelte` | Barra de escaños + tabla de partidos + hemiciclo + mapa de provincias |
| `/senado` | `SenadoView.svelte` | Marcador de posición, sin datos todavía |

`EscrutinioHeader` y `ChamberTabs` viven en `+layout.svelte`, así que son compartidos entre ambas rutas y no se remontan al navegar.

## Datos

- Fuente original: `GENERALES_29N/data-23j/PROV_02_202307_1.xlsx` (resultados oficiales del 23J, fuera de este proyecto).
- `static/data/resultados23j.json` se generó con un script Python puntual (no versionado todavía — ver más abajo) a partir de ese Excel: totales nacionales por partido, comparativa "anterior" inventada para el anillo interior del hemiciclo, y resultados por provincia (ganador + top 3 por votos) para el mapa.
- `static/data/provincias.geojson`: geometría de las 52 provincias (incluye Ceuta y Melilla), descargada de una fuente pública y simplificada con `mapshaper` (`-simplify 10% keep-shapes`) para quedarse en ~75KB en vez del ~1.3MB original.
- `src/lib/data.ts` centraliza el `fetch` de `resultados23j.json` con caché en memoria; todos los componentes que necesitan datos nacionales/por partido pasan por ahí. `MapaProvincias.svelte` hace su propio `fetch` del `.geojson` porque es el único componente que lo usa.
- **Pendiente, a propósito:** el script que generó `resultados23j.json` desde el Excel no está guardado en el repo todavía — estamos en fase de pruebas con datos del 23J como referencia. Cuando empiecen a llegar simulacros reales del 29N se construirá un pipeline versionado (similar al de `ANDALUCIA_2026/scripts/`), probablemente en `GENERALES_29N/elecciones-datos/` (hoy solo un scaffold vacío).
- Cruce de resultados con geometría: siempre por `cod_prov` (código INE de dos dígitos), nunca por nombre — ver detalle en `AGENTS.md`.

## Despliegue

GitHub Pages, repo `Newtral-datos/GENERALES-29N-VIZ`: https://newtral-datos.github.io/GENERALES-29N-VIZ/

`npm run deploy` ejecuta `predeploy` (`npm run build`) y publica `build/` en la rama `gh-pages` con `gh-pages -d build --nojekyll`. El flag `--nojekyll` es imprescindible: sin él, GitHub Pages aplica Jekyll y descarta la carpeta `_app/` (empieza por `_`), dejando toda la web sin JS ni CSS. No basta con tener `static/.nojekyll` porque `gh-pages` excluye los dotfiles del *build* por defecto al copiarlos — el flag crea el archivo directamente en la rama publicada.

`vite.config.ts` fija `paths.base` a `/GENERALES-29N-VIZ` solo cuando `command === 'build'` (en `vite dev` se queda vacío), para que el sitio funcione bajo esa subruta de Pages.

## Credenciales

Panel estático, público. No debe llevar ninguna clave ni token.
