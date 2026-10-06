# Inicio rápido

Esta guía pone en marcha el servidor MCP de datos.gob.es en local y realiza una primera consulta.

## Requisitos

- Node.js 20 o superior
- npm
- Conexión a Internet para consultar el catálogo

## Instalar y arrancar

```bash
git clone https://github.com/Gurriato/mcp-datos-gob-es.git
cd mcp-datos-gob-es
npm install
npm run build
npm start
```

Comprueba el estado en otra terminal:

```bash
curl http://localhost:3000/health
```

La respuesta incluye el estado, versión, transportes y número de herramientas. El endpoint MCP es `http://localhost:3000/mcp`.

## Primera consulta por JSON-RPC

Lista las herramientas disponibles:

```bash
curl -X POST http://localhost:3000/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

Busca conjuntos relacionados con clima:

```bash
curl -X POST http://localhost:3000/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"datos_gob_es_buscar_datasets","arguments":{"query":"clima","limit":3}},"id":2}'
```

En PowerShell, usa `curl.exe` en lugar de `curl` para invocar el ejecutable de cURL.

## Ejecutar sobre Docker

```bash
docker compose up --build
```

El endpoint estará en `http://localhost:3000/mcp`. Para detenerlo, ejecuta `docker compose down`.

## Conectar un cliente

Para opencode, añade el endpoint local `http://localhost:3000/mcp` como MCP remoto. Para Claude Desktop, configura `http://localhost:3000/sse` con transporte `sse`. Si prefieres un proceso sin servidor HTTP, configura Node.js con el argumento `--stdio`.

Los bloques completos de configuración están en [CLIENTS.md](CLIENTS.md).

## Ejecutar pruebas

```bash
npm test
npm run test:live
```

La primera orden prueba el protocolo y las respuestas de error sin usar la red. La segunda realiza además una búsqueda real en datos.gob.es.
