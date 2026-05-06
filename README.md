# PictoMesa

Editor web de tableros de comunicacion aumentativa y alternativa con pictogramas de ARASAAC.

## Funciones

- Busqueda de pictogramas por texto, mejores resultados y ultimos pictogramas desde la API publica de ARASAAC.
- Editor de tablero con filas, columnas, separacion, texto superior/inferior, colores de celda y reordenacion por arrastrar.
- Personalizacion de pictogramas: color/blanco y negro, resolucion, tono de piel y color de pelo cuando ARASAAC lo permite.
- Proyectos y multiples tableros guardados en `localStorage`.
- Exportacion/importacion de proyecto JSON, exportacion PNG, lectura con voz del navegador e impresion.
- Aviso visible de cache: si el usuario borra cache/localStorage pierde los proyectos.
- Atribucion legal en UI, impresion y modal de informacion.

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

## API ARASAAC

La app usa un proxy interno en `src/app/api/arasaac/[...path]/route.ts` hacia `https://api.arasaac.org/api` para evitar problemas de CORS y mantener las peticiones bajo el mismo origen de la web.

Rutas usadas:

- `/pictograms/{language}/search/{query}`
- `/pictograms/{language}/bestsearch/{query}`
- `/pictograms/{language}/new/{limit}`
- `/pictograms/{language}/{id}`
- `/pictograms/{id}?download=false&color=true&resolution=500&skin=white&hair=brown`

## Aviso legal

Los pictogramas son propiedad del Gobierno de Aragon y han sido creados por Sergio Palao para ARASAAC. Se distribuyen bajo licencia Creative Commons BY-NC-SA. Esta app incluye atribucion y aviso de uso no comercial, pero cada despliegue debe revisar si su uso concreto cumple las condiciones de ARASAAC.

Fuentes:

- API: https://arasaac.org/developers/api
- Condiciones de uso: https://aulaabierta.arasaac.org/condiciones-de-uso
- Licencia CC BY-NC-SA: https://creativecommons.org/licenses/by-nc-sa/4.0/
