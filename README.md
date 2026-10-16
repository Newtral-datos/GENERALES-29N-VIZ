# elecciones-panel

Panel de visualización de resultados de las Elecciones Generales del 29 de noviembre (Congreso de los Diputados y Senado). SvelteKit + TypeScript, desplegado como sitio estático en GitHub Pages.

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

Las vistas de **Congreso** y **Senado** están construidas con los resultados del 23 de julio de 2023 (23J) como datos de referencia (no son los del 29N — todavía no existen). Está marcado como tal en el propio código (`// TODO` + "23J" en la UI) para que no se confunda con un resultado real.

La comparativa "elección anterior" (columna "Dif.", anillo interior del hemiciclo, delta de participación) **ya no es simulada**: sale de los exports oficiales en bruto del Ministerio del Interior de noviembre 2019 (10N), procesados por los scripts `*_2019_*` de `elecciones-datos/pipeline/procesado/` — ver "Datos" más abajo.

El panel tiene un interruptor manual para controlar qué se ve públicamente antes de que empiece el escrutinio real: `src/lib/config.ts` → `ESCRUTINIO_ABIERTO`. Con `false` (valor actual), quedan ocultos el `%` de escrutinio y su barra en la cabecera, las pestañas Congreso/Senado, el botón de vuelta a Congreso desde Participación, y el ticker "Última hora" muestra una lista de frases fijas en vez de titulares calculados. Cambiar a `true` + build + deploy es el propio mecanismo de "abrir" el panel la noche electoral — no hay lógica de fecha/hora automática.

## Estructura real

```
elecciones-panel/
├── src/
│   ├── app.css                        # tokens de diseño (color, tipografía, bordes) + estilos base
│   ├── app.html / app.d.ts
│   ├── lib/
│   │   ├── config.ts                  # ESCRUTINIO_ABIERTO — interruptor manual de lanzamiento
│   │   ├── data.ts                    # fetch + caché en memoria de todo static/data/*.json, tipos
│   │   ├── format.ts                  # formatoMiles() y similares
│   │   ├── geo.ts                     # proyección/paths compartidos por los mapas coropléticos
│   │   ├── ticker-content.ts          # titulares fijos (pre-apertura) + calculados (en directo)
│   │   ├── assets/                    # favicon.png, logo-newtral.png
│   │   └── components/                # un componente = un archivo, sin subcarpetas por tipo
│   │       ├── EscrutinioHeader.svelte      # cabecera fija: wordmark, "en directo", % escrutado (gateado)
│   │       ├── ChamberTabs.svelte           # pestañas Congreso / Senado (gateadas)
│   │       ├── TickerUltimaHora.svelte      # cinta de titulares en directo bajo la cabecera
│   │       ├── CongresoView.svelte          # ruta "/": barra + grid (tabla/hemiciclo/mapa) + teasers
│   │       ├── SenadoView.svelte            # ruta "/senado": barra + tabla + mapa por provincia
│   │       ├── BarraEscanos.svelte          # barra apilada de escaños (Congreso)
│   │       ├── BarraSenado.svelte           # barra apilada de senadores de elección directa (208)
│   │       ├── Hemiciclo.svelte             # hemiciclo SVG, anillo actual + anillo "anterior" (2019 real)
│   │       ├── TablaPartidos.svelte         # tabla de resultados por partido (Congreso)
│   │       ├── TablaSenado.svelte           # tabla de senadores electos por partido
│   │       ├── MapaProvincias.svelte        # mapa coroplético Congreso (ganador) + popup hover
│   │       ├── MapaSenado.svelte            # mapa coroplético Senado + rayado en empates reales
│   │       ├── MapaMunicipios.svelte        # mapa de municipios de una provincia (drill-down)
│   │       ├── SelectorProvincias.svelte    # lista de provincias + detalle + buscador de municipios
│   │       ├── ProvinciasView.svelte        # ruta "/provincias"
│   │       ├── ProvinciasTeaser.svelte      # banner de acceso desde la home
│   │       ├── AvancesParticipacion.svelte  # cajitas 14:00/18:00/cierre + número grande de participación
│   │       ├── MapaParticipacion.svelte     # mapa coroplético de % participación (escala secuencial teal)
│   │       ├── RankingParticipacion.svelte  # ranking de provincias por % participación
│   │       ├── ParticipacionView.svelte     # ruta "/participacion"
│   │       ├── ParticipacionTeaser.svelte   # banner de acceso desde la home
│   │       ├── SimuladorPactos.svelte       # simulador de investidura
│   │       └── SimuladorTeaser.svelte       # banner de acceso desde la home
│   └── routes/
│       ├── +layout.svelte             # monta EscrutinioHeader + ChamberTabs + TickerUltimaHora + la vista
│       ├── +layout.ts                 # export const prerender = true (requisito de adapter-static)
│       ├── +page.svelte               # ruta "/" → Congreso
│       ├── senado/+page.svelte        # ruta "/senado"
│       ├── provincias/+page.svelte    # ruta "/provincias"
│       ├── participacion/+page.svelte # ruta "/participacion"
│       └── pactos/+page.svelte        # ruta "/pactos"
├── static/
│   ├── .nojekyll                      # ver nota de despliegue más abajo
│   ├── robots.txt
│   └── data/
│       ├── resultados23j.json               # Congreso: nacional + por provincia, actual + comparativa 2019
│       ├── resultadosSenado23j.json         # Senado: nacional + por provincia, actual + comparativa 2019
│       ├── participacion23j.json            # participación nacional + por provincia, con avances 14h/18h/cierre
│       ├── escanos-congreso-provincias.json # nº de diputados por provincia (lookup)
│       ├── ccaa-provincias.json             # provincia → comunidad autónoma (lookup)
│       ├── indice-municipios.json           # índice plano de 8.131 municipios para el buscador
│       ├── resultados-municipios/<cod>.json # resultados por municipio, uno por provincia (52 ficheros)
│       ├── provincias.geojson               # geometría de las 52 provincias, simplificada con mapshaper
│       └── municipios/<cod>.geojson         # geometría municipal, una por provincia
├── vite.config.ts                     # sveltekit() con adapter-static + paths.base condicional
└── package.json
```

## Rutas

| Ruta | Vista | Contenido |
|---|---|---|
| `/` | `CongresoView.svelte` | Barra de escaños + tabla de partidos + hemiciclo + mapa de provincias + teasers |
| `/senado` | `SenadoView.svelte` | Barra de senadores + tabla de partidos + mapa por provincia |
| `/provincias` | `ProvinciasView.svelte` | Selector de provincia/municipio, resultados detallados y buscador |
| `/participacion` | `ParticipacionView.svelte` | Cajitas de avance, mapa y ranking de participación por provincia |
| `/pactos` | `PactosView.svelte` | Simulador de pactos (coalición PP/PSOE + aliados) |

`EscrutinioHeader`, `ChamberTabs` y `TickerUltimaHora` viven en `+layout.svelte`, así que son compartidos entre todas las rutas y no se remontan al navegar.

## Datos

Todo el procesado vive en `GENERALES_29N/elecciones-datos/pipeline/procesado/` (repositorio aparte, ver su propio README). Cada script lee una fuente oficial del Ministerio del Interior y escribe/enriquece un JSON de `elecciones-panel/static/data/`:

| Script | Fuente | Escribe en |
|---|---|---|
| `congreso_23j_provincias.py` | Excel `PROV_02_202307_1.xlsx` (23J) | `resultados23j.json` → `provincias` |
| `congreso_23j_participacion.py` | mismo Excel | `participacion23j.json` → nacional + provincias (cifras finales) |
| `congreso_23j_municipios.py` | Excel `23j-municipios.xlsx` | `resultados-municipios/*.json` + `indice-municipios.json` |
| `senado_23j.py` | export Senado 23J | `resultadosSenado23j.json` |
| `congreso_2019_anterior.py` | fichero en bruto `07/08xxaamm.DAT` de 10N | `resultados23j.json` → `nacional.partidos[].escanosAnterior` + `nacional.anterior.partidos` (roster completo 2019) |
| `congreso_2019_provincias.py` | mismos ficheros en bruto | `resultados23j.json` → `provincias[].principales[].escanosAnterior` + `.pctVotosAnterior` |
| `congreso_2019_municipios.py` | mismos ficheros en bruto (ficheros 05/06) | `resultados-municipios/*.json` → `.pctVotosAnterior` |
| `congreso_2019_participacion.py` | fichero en bruto `07xxaamm.DAT` | `participacion23j.json` → `censoAnterior`/`votantesAnterior`/`participacionPctAnterior` |
| `congreso_avances_participacion.py` | fichero en bruto `07xxaamm.DAT`, 23J y 2019 | `participacion23j.json` → `nacional.avances[]` + `provincias[].avances[]` (14:00/18:00/cierre) |
| `senado_2019_anterior.py` | Excel candidato-a-candidato `senado2019.xlsx` (10N) | `resultadosSenado23j.json` → `nacional.partidos[].escanosAnterior` |

Notas importantes para quien toque estos scripts:

- Los ficheros en bruto del Ministerio (`nnxxaamm.DAT`, ancho fijo, Windows-1252) no vienen ya normalizados entre territorios: una misma marca nacional se presenta con siglas locales distintas (PSC-PSOE, PSE-EE, PSdeG-PSOE, PP-FORO...). Para Congreso, el fichero de candidaturas trae una "cabecera de acumulación nacional" que resuelve esto; para Senado no existe ese campo y hay que mapear a mano. Ver `AGENTS.md` → "Comparativa con la convocatoria anterior" para el detalle completo.
- `escanosAnterior` / `pctVotosAnterior` es `number | null`. `null` significa "sin continuidad de marca con 2019" (SUMAR no existía, U.P.N. y A.H.I. concurrieron entonces en coaliciones conjuntas) — nunca se fuerza a `0`.
- `src/lib/data.ts` centraliza el `fetch` de todos estos JSON (`getResultados23j()`, `getResultadosSenado23j()`, `getParticipacion23j()`, etc.) con caché en memoria — ningún componente hace su propio `fetch` de datos de resultados. `MapaProvincias`/`MapaSenado`/`MapaParticipacion`/`MapaMunicipios` sí hacen su propio `fetch` del `.geojson` correspondiente, porque son los únicos que lo usan.
- Cruce de resultados con geometría: siempre por `cod_prov` (código INE de dos dígitos), nunca por nombre — ver detalle en `AGENTS.md`.
- Geometría: `provincias.geojson` descargado de una fuente pública y simplificado con `mapshaper` (~75KB); `municipios/*.geojson` repartido por provincia tras simplificar la topología nacional completa — ver `AGENTS.md` → "Resultados por municipio" para el pipeline exacto.

**Pendiente, a propósito:** el bloque `nacional` de `resultados23j.json` (totales 23J, no la comparativa 2019) se generó a mano antes de que existiera `congreso_23j_provincias.py` y no tiene todavía un script propio que lo reproduzca. Cuando se toque, versionarlo igual que el resto.

## Despliegue

GitHub Pages, repo `Newtral-datos/GENERALES-29N-VIZ`: https://newtral-datos.github.io/GENERALES-29N-VIZ/

`npm run deploy` ejecuta `predeploy` (`npm run build`) y publica `build/` en la rama `gh-pages` con `gh-pages -d build --nojekyll`. El flag `--nojekyll` es imprescindible: sin él, GitHub Pages aplica Jekyll y descarta la carpeta `_app/` (empieza por `_`), dejando toda la web sin JS ni CSS. No basta con tener `static/.nojekyll` porque `gh-pages` excluye los dotfiles del *build* por defecto al copiarlos — el flag crea el archivo directamente en la rama publicada.

`vite.config.ts` fija `paths.base` a `/GENERALES-29N-VIZ` solo cuando `command === 'build'` (en `vite dev` se queda vacío), para que el sitio funcione bajo esa subruta de Pages.

## Credenciales

Panel estático, público. No debe llevar ninguna clave ni token.
