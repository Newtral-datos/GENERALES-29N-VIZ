# Arquitectura de `elecciones-panel`

Documento de referencia de cómo está montado el panel: qué hay en cada
carpeta, cómo viajan los datos desde el pipeline hasta la pantalla, y qué
decisiones están tomadas a propósito para que nadie las deshaga sin saberlo.

Las normas transversales del workspace (marca, densidad, mobile-first,
criterios de datos) están en `GENERALES_29N/../AGENTS.md` y manda ese fichero.
Aquí solo está lo propio de este proyecto.

---

## 1. Qué es y qué no es

Un **sitio estático** de SvelteKit (`adapter-static`) desplegado en GitHub
Pages. Visualiza los resultados de las Generales del 29 de noviembre: Congreso,
Senado, participación, resultados por provincia y municipio, y un simulador de
pactos.

Tres límites que definen todo lo demás:

- **No hay servidor.** Ni endpoints, ni sesiones, ni `+page.server.ts`. Todo
  se prerenderiza en el build y el navegador hace el resto.
- **No procesa datos.** El panel lee JSON ya calculados. Toda la lógica de
  normalizar siglas, agregar votos o repartir escaños vive en
  `../elecciones-datos`. Si una cifra está mal, se arregla allí.
- **No lleva secretos.** Todo lo que entra en el bundle es público por
  definición. Las credenciales de la API del Ministerio son cosa de
  `elecciones-datos` y nunca llegan aquí.

Actualizar los datos de la noche electoral es: nuevo JSON en `static/data/` →
`npm run build` → `npm run deploy`. Sin tocar código. Eso es deliberado: un
`fetch` en vivo contra una hoja de cálculo o una API externa ya provocó una vez
datos incoherentes al recargar (media página con datos viejos y media con
nuevos). El build + deploy garantiza que lo publicado es un conjunto coherente.

---

## 2. Estructura de carpetas

```
elecciones-panel/
├── src/
│   ├── app.html                  # plantilla HTML (lang="es"); el favicon se inyecta en +layout
│   ├── app.css                   # tokens de diseño en :root + estilos base (60 líneas, no crece)
│   ├── app.d.ts                  # tipos globales de SvelteKit (sin usar todavía)
│   ├── routes/                   # el router: una carpeta = una URL
│   └── lib/                      # todo lo reutilizable, accesible con el alias #lib/*
│       ├── assets/               # favicon.png, logo-newtral.png
│       ├── components/           # 27 componentes .svelte, directorio plano
│       ├── config.ts             # interruptores de lanzamiento
│       ├── data.ts               # fetch + caché + tipos de todos los JSON
│       ├── format.ts             # formato de números es-ES
│       ├── geo.ts                # proyección y paths SVG para los mapas
│       ├── lideres.ts            # foto + nombre de líder por sigla
│       ├── ticker-content.ts     # titulares del ticker (fijos y calculados)
│       └── compartir-imagen.ts   # generación de PNG en <canvas> para redes
├── static/                       # se sirve tal cual, sin pasar por el bundler
│   ├── .nojekyll
│   ├── robots.txt
│   └── data/                     # los JSON y geojson que produce elecciones-datos
├── docs/arquitectura.md          # este documento
├── vite.config.ts                # adapter-static + paths.base condicional
├── tsconfig.json                 # strict + mapeo de #lib/* para que `npm run check` funcione
├── package.json                  # scripts, deps y el mapeo de imports #lib/*
├── .npmrc  .vscode/  LICENSE  README.md
└── (generado, nunca se versiona) node_modules/  .svelte-kit/  build/
```

### Por qué `components/` es plano

27 ficheros en un solo directorio, sin `charts/`, `ui/` ni `layout/`. Es una
decisión, no un descuido: los nombres ya dicen el dominio (`MapaSenado`,
`TablaPartidos`, `AvancesParticipacion`) y el agrupamiento real que importa es
por **vista**, que ya está explícito en el `routes/` y en los componentes
`*View`. Repartirlos en subcarpetas obligaría a tocar todos los imports para
ganar poco, y la regla del workspace es un componente, una responsabilidad, un
archivo — eso ya se cumple. Si algún día pasan de ~40, se revisa.

### Por qué `#lib/*` y no `$lib`

El proyecto usa el mapeo de imports de Node (`"imports"` en `package.json`:
`#lib/*` → `./src/lib/*`) en vez del alias `$lib` de SvelteKit. Los dos
funcionan; lo importante es **no mezclarlos**, y hoy todo el código usa
`#lib/*`. TypeScript no resuelve por sí solo ese subpath a los `.ts` de origen,
así que `tsconfig.json` lleva el `paths` equivalente: sin él, `npm run check`
reporta un centenar de falsos "Cannot find module '#lib/data'" y deja de servir
para nada.

---

## 3. Flujo de datos

```
elecciones-datos                      elecciones-panel
─────────────────                     ─────────────────
API del Ministerio
   │  (scrapers)
   ▼
data/raw/*.csv
   │  (procesado)
   ▼
static/data/*.json  ──────────────►  data.ts (fetch + caché en memoria)
                                        │
                                        ▼
                                     componentes de vista (*View)
                                        │
                                        ▼
                                     piezas visuales (barra, tabla, mapa…)
```

Reglas del tramo del panel:

- **Siempre `fetch` en tiempo de ejecución, nunca `import` estático** de un
  JSON. Un `import` metería los datos en el bundle y obligaría a recompilar
  lógica para cambiar una cifra.
- **La ruta se construye con `asset()` de `$app/paths`** (no con `base`, que
  en SvelteKit 3 ya no se exporta para esto). Para rutas que se arman en
  tiempo de ejecución — un código de provincia que viene de la URL — hay que
  usar `assetDinamico()` de `data.ts`: `asset()` tipa su argumento con la
  lista literal de ficheros de `static/`, y una plantilla dinámica no encaja
  ahí aunque el fichero exista. El `as` queda encerrado en ese helper para que
  el resto de rutas sí las siga comprobando el compilador.
- **`cache: 'no-cache'` en todos los `fetch`.** Con `force-cache` el navegador
  puede servir indefinidamente un JSON viejo aunque el fichero en disco haya
  cambiado; el síntoma (un campo que "no existe" en el objeto recibido) parece
  un bug de datos y no lo es.
- **Un solo módulo hace los `fetch` de datos: `data.ts`**, con caché en
  memoria por fichero, para que varios componentes de la misma vista no
  dupliquen la petición. Los mapas sí hacen su propio `fetch` del `.geojson`
  que les toca, porque son los únicos que lo usan.
- Esa caché es **por sesión de pestaña**: tras un deploy con datos nuevos hay
  que recargar. No hay recarga periódica todavía (ver §10).

### Ficheros de `static/data/`

| Fichero | Contenido | Lo escribe |
|---|---|---|
| `resultados23j.json` | Congreso 23J: nacional + 52 provincias, con comparativa 2019 | `congreso_23j_*.py`, `congreso_2019_*.py` |
| `resultadosSenado23j.json` | Senado 23J: nacional + provincias + circunscripciones | `senado_23j.py`, `senado_2019_anterior.py` |
| `participacion23j.json` | Participación nacional y por provincia, con los tres cortes | `congreso_23j_participacion.py`, `congreso_avances_participacion.py` |
| `resultados-municipios/<cod>.json` | Resultados por municipio, un fichero por provincia (52) | `congreso_23j_municipios.py`, `congreso_2019_municipios.py` |
| `indice-municipios.json` | Índice plano de 8.131 municipios para el buscador | `congreso_23j_municipios.py` |
| `escanos-congreso-provincias.json` | Diputados a elegir por provincia (lookup) | a mano |
| `ccaa-provincias.json` | Provincia → comunidad autónoma (lookup) | a mano |
| `provincias.geojson` | Geometría de las 52 provincias, simplificada | fuente pública + `mapshaper` |
| `municipios/<cod>.geojson` | Geometría municipal, una por provincia | `generar_geometrias_municipios.sh` |

El recorrido completo al revés —qué script escribe cada JSON y qué
componentes acaba pintando— está en `GENERALES_29N/elecciones-datos/docs/flujo-de-datos.md`, que es el
único sitio donde se cruzan los dos repos.

Los datos que hoy se ven son los de **23J como contenido de prueba**, marcados
como tales en la UI. Los de la jornada real los generará el pipeline del 29N
(`resultados29n.json`, `participacion29n.json`, `resultadosSenado29n.json`,
`resultados-municipios-29n/`), que ya existe en `elecciones-datos` pero
**todavía no está conectado aquí** — ver §10.

### De qué convocatoria se leen los datos: `FUENTE_DATOS`

`src/lib/config.ts` tiene un segundo interruptor manual, independiente de
`ESCRUTINIO_ABIERTO`:

```ts
export const FUENTE_DATOS: '23j' | '29n' = '23j';
```

Responden a preguntas distintas y por eso son dos: `FUENTE_DATOS` decide **qué
datos se leen**, `ESCRUTINIO_ABIERTO` **qué partes se enseñan**.

La conmutación es solo un cambio de ruta, en la tabla `FICHEROS` de `data.ts`.
Funciona porque los JSON del 29N son un **superconjunto** de los de 23J: mismas
claves más `pctEscrutado`, `numEnvio` y `horaTotalizacion` (comprobado fichero a
fichero el 18/11/2026). Los componentes no saben de qué convocatoria leen, y los
getters se llaman `getResultados()`, `getParticipacion()` y
`getResultadosSenado()` — sin el sufijo `23j` que tenían, que habría pasado a
ser mentira.

Los campos nuevos están tipados como **opcionales**, así que una pieza que los
use tiene que decidir qué hace cuando no están. `EscrutinioHeader` y
`CompartirResultados` caen al valor simulado de `ESCRUTINIO_SIMULADO` y **lo
rotulan como simulado** en la UI y en la imagen para compartir; el rótulo
desaparece solo cuando el JSON trae el dato real.

**Por qué es manual y no automático.** Ni por fecha (el reloj del navegador del
visitante no es de fiar) ni por "usa el del 29N si existe": un `fetch` que cae
al de 23J cuando el del 29N da 404 publicaría datos de otra convocatoria con
apariencia de actuales, y podría cambiar de fuente a mitad de la noche si una
petición falla.

Como el fallo que eso evita es invisible en build (`vite build` no hace `fetch`
y `svelte-check` no mira `static/`), hay una comprobación aparte en
`scripts/comprobar-fuente.mjs`, enganchada a `predeploy`: si `FUENTE_DATOS`
pide unos ficheros que no están en `static/data/`, aborta con código 1 y el
`gh-pages` no llega a correr.

### `null` no es `0`

`escanosAnterior` y `pctVotosAnterior` son `number | null`. `null` significa
"no comparable": esa marca no se presentó así en la convocatoria anterior. La
UI pinta `—`, nunca un `+X`/`-X` inventado. `0` solo es válido cuando el
partido sí se presentó y no sacó representación. Lo mismo con los avances de
participación: un corte pendiente va a `null`, no a `0`, porque `0 %` sería un
dato real y falso.

---

## 4. Rutas y composición

`routes/` solo enruta y pone el `<title>`: cada `+page.svelte` monta su
componente `*View` y nada más. Así la vista es un componente normal,
testeable y reutilizable, y el router no acumula layout.

| URL | Página | Vista | Monta |
|---|---|---|---|
| `/` | `+page.svelte` | `CongresoView` | `BarraEscanos`, `TablaPartidos`, `Hemiciclo`, `MapaProvincias`, `CompartirResultados`, y los tres teasers |
| `/senado` | `senado/+page.svelte` | `SenadoView` | `BarraSenado`, `TablaSenado`, `HemicicloSenado`, `MapaSenado` |
| `/provincias` | `provincias/+page.svelte` | `ProvinciasView` | `SelectorProvincias` (que a su vez monta `MapaMunicipios`) |
| `/participacion` | `participacion/+page.svelte` | `ParticipacionView` | `AvancesParticipacion`, `MapaParticipacion`, `RankingParticipacion` |
| `/pactos` | `pactos/+page.svelte` | `PactosView` | `SimuladorPactos` |

`+layout.svelte` monta lo compartido y no se remonta al navegar:
`EscrutinioHeader` (faldón con logo y "en directo"), `ChamberTabs` (pestañas
Congreso/Senado, gateadas por el interruptor) y `TickerUltimaHora`. También
inyecta el favicon y carga `app.css`.

`+layout.ts` tiene `export const prerender = true`, requisito de
`adapter-static`: sin eso no hay HTML que publicar.

**Varias vistas = varias rutas, no condicionales.** Congreso y Senado son
rutas distintas con URL propia y botón atrás del navegador, no un `{#if}`
dentro de un componente gigante.

### El Senado va a escala de 208, no de 266

`BarraSenado` y `HemicicloSenado` se escalan sobre los **208 senadores de
elección directa**, que es lo que se decide en las urnas y lo único que el
panel puede contar la noche electoral. Los 58 designados por los parlamentos
autonómicos no ocupan sitio en el gráfico: llegan semanas después, cada
parlamento con sus plazos, y su número depende de la población (han sido 57 y
58 según la legislatura). Se explican en la nota al pie de ambas piezas.

La consecuencia a tener presente antes de tocar el umbral: **la marca central
señala la mitad de los electos (105), no la mayoría absoluta del Senado**. Es
aritmética, no una preferencia — 134 sobre una escala de 208 cae en el 64 % y
la línea se va a la derecha. Se eligió la marca centrada y rotulada como
"mitad de los electos", con la mayoría absoluta (134 de 266) en la nota al
pie. Lo que no se puede hacer es centrar la línea y seguir llamándola
"mayoría 134".

`HemicicloSenado` dibuja **un cuadrado por senador** — 208 celdas en 6 arcos
concéntricos, cada una girada hacia el centro — en vez de los arcos continuos
del Congreso, porque en el Senado la unidad real es el senador individual: se
elige por voto limitado, candidato a candidato. El reparto de celdas por fila
va en proporción al radio y cuadra el resto por resto mayor, para que la suma
sea exactamente 208; si sobra o falta una celda, el recuento de la cámara deja
de cuadrar y se nota. El `viewBox` arranca en `y=-24` a propósito: con la marca
en el 50 % la etiqueta queda vertical sobre lo alto del arco y con el origen en
0 se salía del lienzo.

En `BarraSenado`, el `padding-top` de `.barra-wrap` **tiene que valer lo que
mide la etiqueta del marcador más su margen** (hoy 26px para dos líneas): la
línea vertical se apila justo debajo del texto, así que si ahí falta espacio el
texto baja y pisa la barra. Al cambiar el rótulo, recalcularlo.

### El caso especial de `/provincias`

8.000+ municipios, y **ni una ruta por municipio**: prerenderizar una página
por cada uno dispararía el build y el peso del sitio en puro boilerplate. En su
lugar, una sola vista que lee el territorio de la query string
(`?cod=28&muni=28079`) y lo resuelve en el cliente. Es igual de enlazable y
compartible que una ruta real.

Esa query string se sincroniza con `replaceState` **de forma imperativa, dentro
del manejador del clic** — nunca desde un `$effect` que lea y escriba
`page.url` a la vez. Un efecto así se vuelve a disparar a sí mismo en bucle y
cuelga la pestaña; pasó exactamente en este proyecto.

---

## 5. Los módulos de `src/lib`

| Módulo | Responsabilidad | Nota |
|---|---|---|
| `config.ts` | `ESCRUTINIO_ABIERTO` y `ESCRUTINIO_SIMULADO` | ver §6 |
| `data.ts` | Un getter por fichero (`getResultados23j()`, `getParticipacion23j()`…), su caché, los tipos de todos los JSON, y `assetDinamico()` | es el contrato entre panel y pipeline: si cambia un JSON, se cambia aquí |
| `format.ts` | `formatMiles()` | `toLocaleString('es-ES')` **no** pone el punto de millar cuando hay un solo dígito antes del primer grupo (`9500` → `"9500"`, pero `15000` → `"15.000"`); es comportamiento real del CLDR, por eso el helper lo fuerza a mano |
| `geo.ts` | `computeBounds`, `fitBox`, `project`, `featurePaths` y los tipos de GeoJSON | proyección equirrectangular con corrección de Mercator (`x *= cos(latMedia)`), suficiente para España a esta escala: sin D3 ni Leaflet |
| `lideres.ts` | Sigla → `{nombre, foto}` | solo URLs verificadas con `HEAD` **y** con CORS (ver §7). En `assets/politicians/` hay copias locales de los cinco líderes como respaldo: hoy no las referencia nadie, pero una imagen del propio bundle es del mismo origen y no depende de que un tercero siga sirviéndola la noche electoral — no borrarlas por "están sin usar" |
| `ticker-content.ts` | Titulares fijos (antes de abrir) y calculados a partir de los JSON ya en memoria | el contenido en directo se deriva de los datos, no de una plantilla que alguien rellene en cada actualización |
| `compartir-imagen.ts` | Helpers de `<canvas>`: texto, insignia de líder, recorte al contenido, exportar/compartir | ver §7 |

`src/lib/index.ts` ya no existe: era el placeholder de la plantilla de
SvelteKit y nadie importaba `#lib` a secas. Lo que se comparte se importa por
su módulo concreto (`#lib/data`, `#lib/geo`…), que deja claro de dónde sale
cada cosa.

---

## 6. El interruptor de lanzamiento

`config.ts` → `ESCRUTINIO_ABIERTO`. Un booleano manual, **no una comprobación
de fecha/hora**: no se puede depender de que el reloj del navegador de cada
visitante sea de fiar. Cambiarlo a `true`, build y deploy *es* el mecanismo de
"abrir" el panel la noche electoral; no hay ningún otro paso.

Con `false` quedan ocultos:

- el `%` de escrutinio y su barra de progreso en `EscrutinioHeader` (el resto
  del faldón, logo y "En directo" incluidos, se queda visible a propósito);
- las pestañas Congreso/Senado (`ChamberTabs`, desde `+layout.svelte`);
- el acceso de vuelta a Congreso desde `ParticipacionView`;
- los titulares calculados del ticker, que pasan a una lista de frases fijas.

**Cada pieza importa el flag y decide por sí misma qué mostrar en su lugar.**
No hay un componente central de "modo apagado" que envuelva el panel: eso
obligaría a que una sola pieza supiera de todas las demás.

Al añadir algo nuevo, la pregunta es si debería nacer gateado: cualquier cosa
que dependa de datos reales de la jornada, sí; algo que tiene sentido aunque el
escrutinio no haya empezado (el simulador de pactos), no.

`ESCRUTINIO_SIMULADO` es el `%` de relleno mientras no hay escrutinio real.
Está marcado con `// TODO` y debe desaparecer en cuanto el panel lea el
`pctEscrutado` real de los JSON del 29N.

---

## 7. Imagen para compartir en redes

Dos puntos generan un PNG dibujado **entero en un `<canvas>` en el cliente**,
sin backend ni servicio de imágenes: `CompartirResultados` (home) y
`SimuladorPactos` ("compartir mi apuesta"). Ambos usan
`compartir-imagen.ts` y `lideres.ts`; `CompartirResultados` además reutiliza la
proyección y los paths de `geo.ts` convertidos a `Path2D`, para no duplicar
lógica de mapa entre la versión interactiva y la imagen.

Tres cosas que hay que saber antes de tocarlo:

- **Texto en canvas:** `fillText(t, x, y)` toma `y` como línea base, y el glifo
  sube por encima una cantidad que depende del tamaño de fuente (con 130px son
  ~100px). Sumar huecos fijos a ojo se queda corto en cuanto cambia el cuerpo
  de letra y un bloque grande se come el de arriba. Los helpers reciben y
  devuelven siempre el **borde superior** del bloque, calculado del tamaño real
  (`ascenso ≈ 0.78 × fontSize`, `descenso ≈ 0.22 × fontSize`).
- **CORS manda sobre la foto.** Una imagen de un host que no manda
  `Access-Control-Allow-Origin` deja el lienzo *tainted* y revienta
  `toBlob`/`toDataURL` con `SecurityError`. El bucket `s3transparentia` de
  Newtral **no** la manda; `live.staticflickr.com` sí. Por eso `lideres.ts`
  solo apunta a fuentes verificadas con `curl -I`, y cualquier sigla sin
  entrada cae a un distintivo de color + sigla en vez de romper la exportación.
  Las fotos locales de políticos que había en `assets/politicians/` se
  eliminaron: quedaron sin usar al pasar todo a Flickr.
- **El techo de compartir a una red concreta no se puede programar.** Ninguna
  red deja adjuntar imagen por URL, y ninguna web puede meter contenido en el
  compositor de otra. Sin backend, el máximo desde el cliente es copiar la
  imagen al portapapeles y abrir el compositor con el texto puesto. En móvil se
  resuelve mejor con `navigator.share`, pero **no basta comprobar que
  `navigator.canShare` existe** para decidir que estamos en móvil: en Safari de
  escritorio existe igual y el share sheet de macOS no ofrece X ni WhatsApp.
  Hay que comprobar plataforma de verdad.

---

## 8. Mapas

Cuatro mapas coropléticos (`MapaProvincias`, `MapaSenado`, `MapaParticipacion`,
`MapaMunicipios`), todos sobre `geo.ts` y SVG a mano.

- **El cruce resultados ↔ geometría es siempre por código INE de provincia**
  (`cod_prov`, dos dígitos con cero a la izquierda: `"04"`, no `"4"`), nunca por
  nombre: los nombres oficiales no coinciden entre fuentes (`"Alicante"` vs.
  `"Alacant/Alicante"`). En municipios, la clave son los 5 últimos dígitos del
  `NATCODE` del geojson, que es el INE provincia+municipio.
- **Canarias va en su propio recuadro**, con bounds y proyección calculados
  aparte. Proyectada en su posición real dentro del mapa peninsular dejaría
  media lámina de océano vacío.
- **Empates reales a escaños** (pasó en Cáceres 23J, 2-2 PP/PSOE) se pintan en
  gris neutro `#9AA0A6` con rayado diagonal, y el popup lo dice. El "ganador"
  que calcula el pipeline en un empate es arbitrario (el primero al ordenar) y
  no debe pintarse como una victoria clara. El panel detecta el empate él mismo
  comparando la composición, no hace falta un campo nuevo en el JSON.
- **El detalle al pasar el ratón es un popup propio**, no el `<title>` nativo:
  ese no se puede maquetar y es invisible en táctil. El popup calcula su
  posición volteando al lado contrario del cursor cuando no hay hueco (no
  recortando contra el borde). Un `<path>` con handlers de ratón necesita
  `role="img"` + `aria-label`; con `role="img"` el elemento es no interactivo,
  así que **no** se le pone `tabindex` (el linter de Svelte lo rechaza).

---

## 9. Estilos y estado

**Estilos.** `app.css` define los tokens en `:root` (`--c` teal corporativo,
`--cd` teal oscuro, `--ink`, `--paper`, `--rule`, `--grey`, `--shadow-hard`,
las familias tipográficas) y unos pocos estilos base. Todo lo demás es CSS con
ámbito dentro de cada componente. No hay framework de CSS ni utilidades
globales, y `app.css` no debería crecer: lo que solo usa un componente, va en
ese componente.

La sombra "de sello" (`--shadow-hard`, offset duro sin difuminado) es la firma
visual del workspace y la señal de "esto es clicable", junto a un `translate`
sutil en `:hover`. No inventar sombras difuminadas nuevas.

**Estado.** Svelte 5 en modo runes (forzado en `vite.config.ts` para todo lo
que no sea `node_modules`). No hay store global: el estado vive en el
componente que lo usa, y lo que se comparte entre vistas va por la URL o se
recalcula de los datos. Un patrón que sí importa: cuando varias piezas dependen
del mismo cálculo — qué avance de participación está activo —, **se calcula una
vez en la vista y se pasa como prop** (`activeIdx`), en vez de que cada
componente lo recalcule con su propia copia. Así el número grande, el mapa y el
ranking cambian juntos cuando entra un avance nuevo.

**Mobile-first, obligatorio.** Todo componente se comprueba a ~375–390px antes
de darse por terminado. Breakpoint único `@media (max-width: 640px)`. El fallo
típico a vigilar es el *blowout* de ancho mínimo: un item de flex/grid tiene
`min-width: auto`, que iguala al ancho intrínseco de su contenido, y una tabla
con `min-width` fijo dentro propaga ese ancho hacia arriba por toda la cadena
de contenedores aunque el padre tenga `width: 100%`. Se arregla con
`min-width: 0` en esa cadena, no escondiendo el síntoma. El contenido ancho va
en su propio contenedor con `overflow-x: auto`; la página nunca scrollea en
horizontal.

---

## 10. Build y despliegue

```bash
npm install
npm run dev       # desarrollo
npm run check     # svelte-check (debe dar 0 errores)
npm run build     # build de producción -> build/
npm run preview   # sirve el build
npm run deploy    # predeploy (build) + publica build/ en la rama gh-pages
```

Publicado en `Newtral-datos/GENERALES-29N-VIZ` →
https://newtral-datos.github.io/GENERALES-29N-VIZ/

Dos cosas imprescindibles y fáciles de romper:

- **`--nojekyll` en el deploy.** GitHub Pages pasa el sitio por Jekyll, que
  ignora cualquier carpeta que empiece por `_` — incluida `_app/`, donde
  SvelteKit mete todo el JS y el CSS. Sin eso, la web carga sin estilos y la
  consola se llena de 404. Y **no basta** con poner `.nojekyll` en `static/`:
  el paquete `gh-pages` excluye los dotfiles al copiar el build. El flag lo
  crea directamente en la rama publicada.
- **`paths.base` solo en build.** `vite.config.ts` fija
  `base: '/GENERALES-29N-VIZ'` cuando `command === 'build'` y lo deja vacío en
  `vite dev`, para que el sitio funcione bajo la subruta de Pages sin romper el
  desarrollo local.

El build en sí tarda ~2s; el cuello de botella real es la propagación del CDN
de GitHub Pages (Fastly, 1-2 min, fuera de nuestro control). Si hiciera falta
acelerar, lo que se valoraría es cambiar solo el **destino** del deploy a
Cloudflare Pages u otro hosting con deploys atómicos — manteniendo el patrón
"build + deploy de una carpeta ya generada", nunca un fetch en vivo.

---

## 11. Pendiente

Lo que falta, a propósito y por orden de urgencia para la noche del 29N:

1. **Conectar los JSON del 29N.** `elecciones-datos` ya genera
   `resultados29n.json`, `participacion29n.json`, `resultadosSenado29n.json` y
   `resultados-municipios-29n/`, con la misma forma que los de 23J más unos
   campos nuevos (`pctEscrutado`, `numEnvio`, `horaTotalizacion`). Hay que
   añadir sus getters en `data.ts` y decidir cómo se conmuta entre los datos de
   prueba de 23J y los reales.
2. **Sustituir `ESCRUTINIO_SIMULADO`** por el `pctEscrutado` real de esos JSON
   (lo usan `EscrutinioHeader` y la imagen de compartir).
3. **Recarga periódica**: cada ~5 min y al recuperar el foco de la ventana, el
   patrón que ya se usó en Andalucía. Hoy hay que recargar a mano.
4. **Un script que reproduzca el bloque `nacional` de `resultados23j.json`**:
   se generó a mano antes de que existiera el resto del pipeline y es el único
   dato del panel sin script propio.
5. **Comprobar en navegador `HemicicloSenado` y `BarraSenado`**: el hover por
   partido, cómo envuelve la leyenda y, sobre todo, el ancho de móvil a 375px
   — la etiqueta "Mitad de los electos" lleva `white-space: nowrap` y podría
   sobresalir. La geometría sí está verificada rasterizando el SVG, pero eso
   no cubre nada de lo anterior.
6. Los 7 warnings de accesibilidad que quedan en `npm run check`, todos del
   mismo patrón de `<path>` con handlers de ratón en los mapas.
