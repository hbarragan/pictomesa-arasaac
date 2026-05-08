# Amaretea

Editor web no comercial de tableros de comunicacion aumentativa y alternativa, creado desde https://amaretea.es/ para apoyar el dia a dia de docentes de educacion especial.

## Funciones

- Busqueda de pictogramas por texto, mejores resultados y ultimos pictogramas desde un proveedor publico de imagenes.
- Editor de tablero con filas, columnas, separacion, texto superior/inferior, colores de celda y reordenacion por arrastrar.
- Personalizacion de pictogramas: color/blanco y negro, resolucion, tono de piel y color de pelo cuando el proveedor lo permite.
- Proyectos y multiples tableros guardados en `localStorage`.
- Exportacion/importacion de proyecto JSON, exportacion PNG, lectura con voz del navegador e impresion.
- Aviso visible de cache: si el usuario borra cache/localStorage pierde los proyectos.
- Aviso legal y atribucion en UI, impresion y modal de informacion.

## Desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Produccion

```bash
npm run build
npm run start
```

## Proveedor de pictogramas

La app usa un proxy interno en `src/app/api/arasaac/[...path]/route.ts` hacia `https://api.arasaac.org/api`. ARASAAC se muestra en la interfaz solo como proveedor/creditos/licencia de pictogramas, no como propietario, creador o responsable de esta herramienta.

Rutas usadas:

- `/pictograms/{language}/search/{query}`
- `/pictograms/{language}/bestsearch/{query}`
- `/pictograms/{language}/new/{limit}`
- `/pictograms/{language}/{id}`
- `/pictograms/{id}?download=false&color=true&resolution=500&skin=white&hair=brown`

## Aviso legal

Esta herramienta se ofrece sin animo de comercializar pictogramas ni generar ingresos por su uso. Los pictogramas obtenidos del proveedor ARASAAC son de Sergio Palao, titularidad del Gobierno de Aragon, y se distribuyen bajo licencia Creative Commons BY-NC-SA. La app incluye atribucion, origen, licencia y aviso de uso no comercial, pero cada despliegue y cada usuario debe revisar si su uso concreto cumple las condiciones aplicables.

La herramienta no esta afiliada ni respaldada por ARASAAC o el Gobierno de Aragon. No almacena proyectos, pictogramas ni imagenes locales en servidor; el guardado ocurre en el navegador. Cada usuario es responsable de la idoneidad pedagogica o clinica, de los derechos sobre imagenes locales, de la atribucion y de la impresion o distribucion de los materiales generados. Este aviso es informativo y no sustituye asesoramiento legal.

Fuentes:

- API: https://arasaac.org/developers/api
- Condiciones de uso: https://aulaabierta.arasaac.org/condiciones-de-uso
- Licencia CC BY-NC-SA: https://creativecommons.org/licenses/by-nc-sa/4.0/
