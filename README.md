<div align="center">

# MCP datos.gob.es

**Explora el Catálogo Nacional de Datos Abiertos de España desde opencode, Claude y cualquier cliente MCP.**

[![CI](https://github.com/Gurriato/mcp-datos-gob-es/actions/workflows/ci.yml/badge.svg)](https://github.com/Gurriato/mcp-datos-gob-es/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-6f42c1)](https://modelcontextprotocol.io/)

[Español](#español) · [English](#english)

</div>

## Español

Servidor **Model Context Protocol (MCP)** para consultar el catálogo de datos abiertos de [datos.gob.es](https://datos.gob.es/es/catalogo). Incluye transporte **Streamable HTTP** y **SSE**, servidor local **stdio**, despliegue en **Cloudflare Workers** y ejemplos listos para configurar en opencode y Claude.

> Este proyecto descubre fichas y metadatos del catálogo. No descarga ni analiza automáticamente el contenido de cada fichero distribuido. Consulta la ficha de origen para conocer la licencia, cobertura y condiciones de reutilización de cada conjunto.

## Características

- **5 herramientas MCP** para buscar conjuntos de datos, explorar temas, obtener fichas y consultar totales del catálogo.
- **Tres formas de conexión**: Streamable HTTP, SSE clásico y `stdio`.
- **Cloudflare Workers** para publicar un endpoint remoto sin mantener un servidor Node.js.
- Sesiones SSE persistentes en Cloudflare mediante Durable Objects, compatibles con varias instancias del Worker.
- **Ejecución local** con Node.js o Docker Compose.
- **API sin clave**: consume la API pública de datos.gob.es.
- **Respuestas normalizadas en español**, incluso cuando la API devuelve campos multilingües.
- Timeout, errores legibles y caché en memoria con TTL para reducir llamadas repetidas.
- Pruebas de protocolo sin red y pruebas opcionales contra la API real.

## Conecta con el servicio público

El servidor está disponible en Cloudflare Workers. No necesitas instalar el proyecto ni usar una clave de API para conectarte:

- **Endpoint MCP (opencode y clientes Streamable HTTP):** [`https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/mcp`](https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/mcp)
- **Endpoint SSE (Claude Desktop y clientes compatibles):** [`https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/sse`](https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/sse)
- **Estado del servicio:** [`/health`](https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/health)

### Conectar opencode

Añade este bloque a `opencode.json`:

```json
{
  "mcp": {
    "datos-gob-es": {
      "type": "remote",
      "url": "https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/mcp",
      "enabled": true
    }
  }
}
```

### Conectar Claude Desktop

Añade este bloque a `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datos-gob-es": {
      "url": "https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/sse",
      "transport": "sse"
    }
  }
}
```

Reinicia el cliente MCP después de guardar la configuración. Encontrarás más opciones —incluidos los modos locales— en [CLIENTS.md](CLIENTS.md).

## Herramientas MCP

| Herramienta | Descripción |
| --- | --- |
| `datos_gob_es_buscar_datasets` | Busca conjuntos de datos por palabras del título. Admite paginación y límite de resultados. |
| `datos_gob_es_listar_temas` | Lista los temas del catálogo y sus identificadores. |
| `datos_gob_es_buscar_por_tema` | Busca conjuntos de datos asociados a un identificador de tema. |
| `datos_gob_es_obtener_dataset` | Recupera descripción, publicador, palabras clave, fechas, licencia, cobertura y distribuciones de una ficha. |
| `datos_gob_es_resumen_catalogo` | Obtiene totales de conjuntos, distribuciones, organismos publicadores y temas mediante una consulta agregada al punto SPARQL oficial. |

### Ejemplos de consultas

- «Busca conjuntos de datos sobre calidad del aire y muéstrame tres»
- «¿Qué temas hay disponibles en el catálogo de datos abiertos?»
- «Busca datasets de salud publicados en el catálogo»
- «Dame los detalles y enlaces de descarga del dataset `ID_DEL_DATASET`»
- «¿Cuántos conjuntos de datos y organismos publicadores tiene el catálogo?»

## Inicio rápido

Requisitos: **Node.js 20 o superior** y npm.

```bash
git clone https://github.com/Gurriato/mcp-datos-gob-es.git
cd mcp-datos-gob-es
npm install
npm run build
npm start
```

El servidor HTTP local queda disponible en `http://localhost:3000`:

- MCP Streamable HTTP: `http://localhost:3000/mcp`
- SSE clásico: `http://localhost:3000/sse`
- Estado: `http://localhost:3000/health`
- Página informativa: `http://localhost:3000/`

Para usar el transporte estándar local `stdio`:

```bash
npm run start:stdio
```

Guías detalladas: [inicio rápido](QUICKSTART.md), [configuración de clientes](CLIENTS.md) y [API y arquitectura](docs/API.md).

## Conectar clientes MCP

### opencode — endpoint remoto

Añade a `opencode.json` (o a la configuración de proyecto correspondiente):

```json
{
  "mcp": {
    "datos-gob-es": {
      "type": "remote",
      "url": "https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/mcp",
      "enabled": true
    }
  }
}
```

Para conectar con el servidor local por HTTP, sustituye la URL por `http://localhost:3000/mcp`.

### Claude Desktop — endpoint SSE

En el archivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datos-gob-es": {
      "url": "https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/sse",
      "transport": "sse"
    }
  }
}
```

También puedes usar `http://localhost:3000/sse` con el servidor local. La ruta SSE clásica facilita la compatibilidad con versiones de clientes que aún no ofrecen conexión MCP remota por Streamable HTTP.

### Claude Desktop — proceso local `stdio`

```json
{
  "mcpServers": {
    "datos-gob-es": {
      "command": "node",
      "args": ["C:/ruta/al/mcp-datos-gob-es/dist/index.js", "--stdio"]
    }
  }
}
```

Consulta [CLIENTS.md](CLIENTS.md) para otras configuraciones, rutas por sistema operativo y solución de problemas.

## Despliegue en Cloudflare Workers

### Con el botón de despliegue

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Gurriato/mcp-datos-gob-es)

Cloudflare te pedirá iniciar sesión y autorizar la creación del Worker desde este repositorio.

### Con Wrangler

```bash
npm install
npx wrangler login
npm run dev:worker     # desarrollo local, http://localhost:8787
npm run deploy         # publica mcp-datos-gob-es en Cloudflare
```

La configuración incluye la migración del Durable Object que mantiene las sesiones SSE. Wrangler la aplica durante el despliegue.

Comprueba el Worker una vez publicado:

```bash
curl https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/health
```

Para un dominio propio, añade la ruta o el dominio personalizado desde el panel de Cloudflare o la configuración de Wrangler. El endpoint MCP quedará en `/mcp` y el SSE clásico en `/sse`.

## Desarrollo local y pruebas

```bash
npm install
npm run dev             # servidor HTTP local con recarga
npm run build           # compilar TypeScript
npm test                # pruebas MCP sin llamadas a la API
npm run test:live       # prueba adicional de búsqueda contra datos.gob.es
```

Variables opcionales para el servidor Node local:

| Variable | Predeterminado | Descripción |
| --- | --- | --- |
| `MCP_PORT` | `3000` | Puerto HTTP local. |
| `MCP_HOST` | `0.0.0.0` | Interfaz de red local. |
| `DATOS_GOB_ES_API_BASE` | `https://datos.gob.es/apidata` | URL base de la API. |
| `DATOS_GOB_ES_TIMEOUT_MS` | `15000` | Timeout de solicitudes en milisegundos. |
| `DATOS_GOB_ES_CACHE_TTL_MS` | `300000` | TTL de la caché en milisegundos; `0` la desactiva. |

Puedes copiar `.env.example` como referencia. Node.js no carga automáticamente ese archivo: exporta las variables en tu entorno o usa una herramienta como `dotenv` en tu configuración local.

## Docker

```bash
docker compose up --build
```

El endpoint MCP estará en `http://localhost:3000/mcp`. La imagen puede ejecutarse también con `stdio` si el cliente MCP lanza el contenedor como proceso.

## API de datos.gob.es

El servidor consulta la API pública `https://datos.gob.es/apidata`, que expone los metadatos del catálogo nacional. Algunas rutas utilizadas:

- `/catalog/dataset/title/{texto}.json` — búsqueda por título.
- `/catalog/theme.json` — listado de temas.
- `/catalog/dataset/theme/{tema}.json` — búsqueda por tema.
- `/catalog/dataset/{id}.json` — ficha de un conjunto.
- `/catalog/distribution.json` y `/catalog/publisher.json` — recursos del catálogo.

La operación de resumen utiliza el [punto SPARQL oficial](https://datos.gob.es/es/ejemplos-sparql) para obtener recuentos exactos en una única consulta agregada. La búsqueda paginada informa cuántos resultados trae la página y si hay una página siguiente; la API de catálogo no publica un total de coincidencias en su respuesta JSON estándar.

Referencia oficial: [API de datos.gob.es](https://datos.gob.es/es/apidata). La API puede actualizar o modificar sus respuestas y disponibilidad; cada respuesta muestra los metadatos publicados por la fuente.

## Estructura

```text
mcp-datos-gob-es/
├── src/
│   ├── api-client.ts       # Cliente HTTP, timeout y caché de la API
│   ├── index.ts            # Entrada local HTTP y stdio
│   ├── tools.ts            # Esquemas y lógica de herramientas MCP
│   ├── types.ts            # Tipos compartidos
│   └── worker.ts           # Transportes Streamable HTTP y SSE para Cloudflare
├── test/smoke.mjs          # Pruebas locales y prueba opcional en vivo
├── docs/API.md             # Referencia técnica de herramientas y transportes
├── CLIENTS.md              # Configuración para clientes MCP
├── QUICKSTART.md            # Instalación y primera consulta
├── Dockerfile
├── docker-compose.yml
└── wrangler.toml
```

## Créditos y licencia

Proyecto independiente, no oficial, desarrollado por [Gurriato](https://github.com/Gurriato). Está inspirado en la estructura de distribución del [MCP del INE](https://github.com/manalejandro/mcp-ine) y en el ejercicio didáctico [Agente Conversacional con MCP server](https://github.com/Admindatosgobes/Laboratorio-de-Datos/tree/main/Data%20Science/Agente%20Conversacional%20con%20MCP%20server), cuyo README y notebook documentan el uso de la API de datos.gob.es con herramientas MCP. El diseño y la implementación de este repositorio se han realizado de forma independiente.

El código de este repositorio se distribuye bajo licencia [MIT](LICENSE). Los datos, metadatos y ficheros enlazados mantienen las licencias y condiciones definidas por sus respectivos publicadores. La titularidad y los términos de la API corresponden a [datos.gob.es](https://datos.gob.es/es/aviso-legal).

---

## English

**Explore Spain's National Open Data Catalog from opencode, Claude, and any MCP-compatible client.**

This **Model Context Protocol (MCP)** server provides access to the [datos.gob.es](https://datos.gob.es/en/catalogue) open data catalog. It supports **Streamable HTTP**, **SSE**, and local **stdio**, can run on **Cloudflare Workers**, and includes setup instructions for opencode and Claude.

> This project discovers catalog records and metadata. It does not automatically download or analyse the contents of dataset files. Check each source record for its license, coverage, and reuse conditions.

### Features

- **5 MCP tools** to search datasets, explore themes, retrieve records, and query catalog statistics.
- **Three connection options**: Streamable HTTP, legacy SSE, and `stdio`.
- **Cloudflare Workers** deployment for a remote endpoint without managing a Node.js server.
- Persistent Cloudflare SSE sessions backed by Durable Objects, including across Worker instances.
- **Local execution** with Node.js or Docker Compose.
- **No API key required**: uses the public datos.gob.es API.
- **Spanish-normalised responses**, including multilingual API fields.
- Request timeouts, readable errors, and an in-memory TTL cache to reduce repeated requests.
- Offline protocol tests and optional live tests against the public API.

### Connect to the public server

The server is available on Cloudflare Workers. You do not need to install the project or provide an API key:

- **MCP endpoint (opencode and Streamable HTTP clients):** [`https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/mcp`](https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/mcp)
- **SSE endpoint (Claude Desktop and compatible clients):** [`https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/sse`](https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/sse)
- **Service health:** [`/health`](https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/health)

#### Connect opencode

Add this configuration to `opencode.json`:

```json
{
  "mcp": {
    "datos-gob-es": {
      "type": "remote",
      "url": "https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/mcp",
      "enabled": true
    }
  }
}
```

#### Connect Claude Desktop

Add this configuration to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datos-gob-es": {
      "url": "https://mcp-datos-gob-es.datos-abiertos-es.workers.dev/sse",
      "transport": "sse"
    }
  }
}
```

Restart your MCP client after saving the configuration. See [CLIENTS.md](CLIENTS.md) for more options, including local connections.

### MCP tools

| Tool | Description |
| --- | --- |
| `datos_gob_es_buscar_datasets` | Search dataset titles by keyword or phrase, with pagination and a result limit. |
| `datos_gob_es_listar_temas` | List catalog themes and their identifiers. |
| `datos_gob_es_buscar_por_tema` | Search datasets associated with a theme identifier. |
| `datos_gob_es_obtener_dataset` | Retrieve a record's description, publisher, keywords, dates, license, coverage, and distributions. |
| `datos_gob_es_resumen_catalogo` | Get dataset, distribution, publisher, and theme counts using the official SPARQL endpoint. |

Example prompts:

- “Find datasets about air quality and show me three.”
- “Which themes are available in the open data catalog?”
- “Find health datasets published in the catalog.”
- “Show me the details and download links for dataset `DATASET_ID`.”
- “How many datasets and publishers are in the catalog?”

### Quick start (local)

Requirements: **Node.js 20 or later** and npm.

```bash
git clone https://github.com/Gurriato/mcp-datos-gob-es.git
cd mcp-datos-gob-es
npm install
npm run build
npm start
```

The local HTTP server is available at `http://localhost:3000`:

- Streamable HTTP MCP: `http://localhost:3000/mcp`
- Legacy SSE: `http://localhost:3000/sse`
- Health check: `http://localhost:3000/health`
- Information page: `http://localhost:3000/`

To run the local `stdio` transport, use `npm run start:stdio`.

For local clients, opencode can use `http://localhost:3000/mcp` as a remote MCP endpoint. Claude Desktop can use `http://localhost:3000/sse` with the `sse` transport. A local Claude `stdio` configuration looks like this:

```json
{
  "mcpServers": {
    "datos-gob-es": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-datos-gob-es/dist/index.js", "--stdio"]
    }
  }
}
```

On Windows, replace the path with an absolute path such as `C:/projects/mcp-datos-gob-es/dist/index.js`.

### Cloudflare Workers deployment

Deploy from the [Cloudflare Workers button](https://deploy.workers.cloudflare.com/?url=https://github.com/Gurriato/mcp-datos-gob-es), or use Wrangler:

```bash
npm install
npx wrangler login
npm run dev:worker     # local development at http://localhost:8787
npm run deploy         # publish the Worker to Cloudflare
```

The configuration includes the Durable Object migration required for persistent SSE sessions. Wrangler applies it during deployment.

For local development and tests, run `npm run build`, `npm test`, and optionally `npm run test:live`. Start Docker with `docker compose up --build`.

Optional environment variables for the local Node.js server:

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_PORT` | `3000` | Local HTTP port. |
| `MCP_HOST` | `0.0.0.0` | Network interface to bind to. |
| `DATOS_GOB_ES_API_BASE` | `https://datos.gob.es/apidata` | API base URL. |
| `DATOS_GOB_ES_TIMEOUT_MS` | `15000` | Request timeout in milliseconds. |
| `DATOS_GOB_ES_CACHE_TTL_MS` | `300000` | Cache TTL in milliseconds; `0` disables it. |

Node.js does not automatically load `.env.example`; export the variables in your environment or use a tool such as `dotenv` for local development.

### Data sources

Dataset search, themes, and records use the official [datos.gob.es API](https://datos.gob.es/en/apidata). Some endpoints used by the server are:

- `/catalog/dataset/title/{text}.json` — search by title.
- `/catalog/theme.json` — list themes.
- `/catalog/dataset/theme/{theme}.json` — search by theme.
- `/catalog/dataset/{id}.json` — retrieve a dataset record.

Catalog statistics use the [official SPARQL endpoint](https://datos.gob.es/en/sparql). The API's paginated search response does not provide a total match count, so search results report the current page size and whether another page is available.

### Docker

```bash
docker compose up --build
```

The MCP endpoint is available at `http://localhost:3000/mcp`. Stop the service with `docker compose down`.

### Project structure

```text
mcp-datos-gob-es/
├── src/                    # API client, MCP tools, local server, Cloudflare Worker
├── test/smoke.mjs          # Offline protocol tests and optional live API checks
├── docs/API.md             # API, tools, transports, and architecture
├── CLIENTS.md              # Client setup instructions
├── QUICKSTART.md           # Installation and first request
├── Dockerfile
├── docker-compose.yml
└── wrangler.toml
```

### Documentation and project files

- [Quick start](QUICKSTART.md)
- [MCP client configuration](CLIENTS.md)
- [API and architecture reference](docs/API.md)
- [Contributing](CONTRIBUTING.md)
- [MIT License](LICENSE)

### Credits and license

An independent, unofficial project by [Gurriato](https://github.com/Gurriato), inspired by the structure of the [INE MCP server](https://github.com/manalejandro/mcp-ine) and the educational [Conversational Agent with MCP server](https://github.com/Admindatosgobes/Laboratorio-de-Datos/tree/main/Data%20Science/Agente%20Conversacional%20con%20MCP%20server). The latter's README and notebook demonstrate MCP tools for the datos.gob.es API; this repository's design and implementation were developed independently.

The code in this repository is released under the [MIT License](LICENSE). Data, metadata, and linked files remain subject to the terms set by their respective publishers. See the [datos.gob.es legal notice](https://datos.gob.es/en/legal-notice) for information about the source API.
