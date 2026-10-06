# API y arquitectura

## Componentes

- `src/api-client.ts`: encapsula las solicitudes a datos.gob.es, aplica timeout y caché TTL limitada.
- `src/tools.ts`: declara los esquemas que descubre el cliente MCP, valida argumentos y normaliza las respuestas de la API.
- `src/worker.ts`: implementa Streamable HTTP (`POST /mcp`), SSE clásico (`GET /sse`, `POST /message`), la página de información y `/health` usando APIs web estándar.
- `src/index.ts`: expone el mismo Worker en HTTP local y añade stdio mediante `@modelcontextprotocol/sdk`.

```text
Cliente MCP (opencode / Claude / otro)
                 │
      Streamable HTTP · SSE · stdio
                 │
      Herramientas de datos.gob.es
                 │
      https://datos.gob.es/apidata
```

No se integra un LLM ni una interfaz de chat: el servidor MCP se puede reutilizar con cualquier agente compatible.

## Herramientas y argumentos

### `datos_gob_es_buscar_datasets`

- `query` (string, obligatorio): texto del título a buscar.
- `limit` (entero 1–50, opcional, predeterminado 10): resultados por página.
- `page` (entero ≥ 0, opcional, predeterminado 0): índice de página.

Llama a `/catalog/dataset/title/{query}.json`. La respuesta incluye `pagina`, `resultados_por_pagina`, `resultados_en_pagina`, `hay_mas_resultados` y `conjuntos_datos`. El formato estándar de la API no incluye el total de coincidencias; `hay_mas_resultados` indica si el catálogo ofrece una página siguiente.

### `datos_gob_es_listar_temas`

Sin argumentos. Llama a `/catalog/theme.json` y devuelve `total` y `temas`, cada uno con ID, etiqueta y URI.

### `datos_gob_es_buscar_por_tema`

- `theme_id` (string, obligatorio): identificador de tema.
- `limit` y `page`: mismos límites que en la búsqueda por título.

Llama a `/catalog/dataset/theme/{theme_id}.json`.

### `datos_gob_es_obtener_dataset`

- `dataset_id` (string, obligatorio): identificador de catálogo.

Llama a `/catalog/dataset/{dataset_id}.json` y devuelve los metadatos normalizados, incluidas las distribuciones y sus URLs disponibles.

### `datos_gob_es_resumen_catalogo`

Sin argumentos. Consulta el punto SPARQL oficial con una agregación sobre el grafo del catálogo para contar conjuntos, distribuciones, publicadores y temas. Los recuentos describen los datos publicados en el momento de la consulta.

## Protocolo y endpoints

### Streamable HTTP

- `POST /mcp`: solicitudes MCP JSON-RPC 2.0: `initialize`, `ping`, `tools/list` y `tools/call`.
- `OPTIONS /mcp`: preflight CORS.

El endpoint opera sin estado de sesión y devuelve respuestas JSON. Las notificaciones MCP responden `202 Accepted` sin cuerpo.

### SSE clásico

- `GET /sse`: abre un stream y entrega el evento `endpoint` con la ruta de envío `/message?sessionId=...`.
- `POST /message?sessionId=...`: envía peticiones JSON-RPC; las respuestas se reciben en el stream SSE.

### Otros endpoints

- `GET /health`: estado, versión, transportes y herramientas registradas.
- `GET /`: página de información con endpoints y configuración de clientes.

## Respuesta de herramienta

Las herramientas devuelven contenido legible (`content`) y un objeto estructurado (`structuredContent`) para clientes que admitan resultados tipados. Los fallos de validación, API o red se devuelven como `isError: true` con un mensaje útil.

## API pública de datos.gob.es

Las fuentes son la [API oficial](https://datos.gob.es/es/apidata) y el [punto SPARQL](https://datos.gob.es/es/ejemplos-sparql) de datos.gob.es. Los campos de idioma se normalizan priorizando español (`es`) y recurriendo al primer valor publicado si no existe. Las fichas son la fuente de verdad para licencias y condiciones de reutilización.
