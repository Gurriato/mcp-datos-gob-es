<div align="center">

# MCP datos.gob.es

**Explora el Catálogo Nacional de Datos Abiertos de España desde opencode, Claude y cualquier cliente MCP.**

[![CI](https://github.com/Gurriato/mcp-datos-gob-es/actions/workflows/ci.yml/badge.svg)](https://github.com/Gurriato/mcp-datos-gob-es/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/Protocol-MCP-6f42c1)](https://modelcontextprotocol.io/)

</div>

Servidor **Model Context Protocol (MCP)** para consultar el catálogo de datos abiertos de [datos.gob.es](https://datos.gob.es/es/catalogo). Incluye transporte **Streamable HTTP** y **SSE**, servidor local **stdio**, despliegue en **Cloudflare Workers** y ejemplos listos para configurar en opencode y Claude.

> Este proyecto descubre fichas y metadatos del catálogo. No descarga ni analiza automáticamente el contenido de cada fichero distribuido. Consulta la ficha de origen para conocer la licencia, cobertura y condiciones de reutilización de cada conjunto.

## Características

- **5 herramientas MCP** para buscar conjuntos de datos, explorar temas, obtener fichas y consultar totales del catálogo.
- **Tres formas de conexión**: Streamable HTTP, SSE clásico y `stdio`.
- **Cloudflare Workers** para publicar un endpoint remoto sin mantener un servidor Node.js.
- **Ejecución local** con Node.js o Docker Compose.
- **API sin clave**: consume la API pública de datos.gob.es.
- **Respuestas normalizadas en español**, incluso cuando la API devuelve campos multilingües.
- Timeout, errores legibles y caché en memoria con TTL para reducir llamadas repetidas.
- Pruebas de protocolo sin red y pruebas opcionales contra la API real.

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
      "url": "https://TU-WORKER.workers.dev/mcp",
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
      "url": "https://TU-WORKER.workers.dev/sse",
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

Comprueba el Worker una vez publicado:

```bash
curl https://TU-WORKER.workers.dev/health
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
