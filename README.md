# elecciones-panel

Panel de visualización de resultados de las Elecciones Generales del 29 de
noviembre (Congreso y Senado). SvelteKit + TypeScript, desplegado como sitio
estático en GitHub Pages.

👉 **Cómo está montado por dentro: [`docs/arquitectura.md`](docs/arquitectura.md)**
— carpetas, flujo de datos, rutas, mapas, imagen para compartir, despliegue y
lo que queda pendiente. Las normas transversales del workspace (marca,
densidad, mobile-first, criterios de datos) están en el `AGENTS.md` de la raíz.

Dónde se quedó el trabajo y qué toca después: [`../ESTADO.md`](../ESTADO.md).

## Arrancar

```bash
npm install
npm run dev       # servidor de desarrollo
npm run check     # svelte-check (debe dar 0 errores)
npm run build     # build de producción (adapter-static → build/)
npm run preview   # sirve el build de producción
npm run deploy    # build + publica build/ en la rama gh-pages
```

Publicado en https://newtral-datos.github.io/GENERALES-29N-VIZ/

## Lo esencial

- **El panel no procesa datos.** Lee los JSON que `../elecciones-datos` deja en
  `static/data/`. Si una cifra está mal, se arregla en el pipeline, no aquí.
  Cada script de `elecciones-datos/pipeline/procesado/` declara en su docstring
  qué fichero escribe.
- **Actualizar datos no requiere tocar código**: nuevo JSON → `npm run build` →
  `npm run deploy`.
- **No lleva ninguna clave.** Es una web estática y pública; las credenciales
  de la API del Ministerio son cosa de `elecciones-datos`.

## Estado actual

Las vistas de Congreso y Senado se ven con los resultados del **23J como
contenido de prueba** (marcado como tal en la UI). El pipeline del 29N ya
genera los JSON de la jornada real, pero **todavía no están conectados**: ver
"Pendiente" en el documento de arquitectura.

La comparativa "elección anterior" (columna "Dif.", anillo interior del
hemiciclo, delta de participación) no es simulada: sale de los exports
oficiales del Ministerio.

`src/lib/config.ts` → **`ESCRUTINIO_ABIERTO`** es el interruptor manual de
lanzamiento: con `false` se ocultan el `%` de escrutinio, las pestañas
Congreso/Senado y los titulares calculados del ticker. Cambiarlo a `true` +
build + deploy es el mecanismo de abrir el panel la noche electoral; no hay
lógica de fecha automática.
