# Configuración de clientes MCP

El proyecto ofrece tres conexiones:

| Transporte | Endpoint / comando | Uso habitual |
| --- | --- | --- |
| Streamable HTTP | `POST /mcp` | opencode y clientes MCP remotos actuales |
| SSE clásico | `GET /sse` | Claude Desktop y clientes compatibles con SSE |
| stdio | `node dist/index.js --stdio` | Claude Desktop local y clientes que lanzan procesos |

## opencode

### Worker remoto

En `opencode.json`:

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

### Servidor local por HTTP

Arranca `npm start` y configura:

```json
{
  "mcp": {
    "datos-gob-es-local": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": true
    }
  }
}
```

### Proceso local stdio

```json
{
  "mcp": {
    "datos-gob-es": {
      "type": "local",
      "command": ["node", "C:/ruta/mcp-datos-gob-es/dist/index.js", "--stdio"],
      "enabled": true
    }
  }
}
```

La sintaxis exacta puede variar según la versión de opencode; consulta [MCP servers en opencode](https://opencode.ai/docs/mcp-servers/).

## Claude Desktop

Abre el archivo de configuración de Claude Desktop.

Ubicaciones comunes:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Conexión remota SSE

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

### Servidor local SSE

Con `npm start` ejecutándose:

```json
{
  "mcpServers": {
    "datos-gob-es-local": {
      "url": "http://localhost:3000/sse",
      "transport": "sse"
    }
  }
}
```

### Proceso local stdio

Compila una vez (`npm install && npm run build`) y configura la ruta absoluta de Node y del proyecto:

```json
{
  "mcpServers": {
    "datos-gob-es": {
      "command": "node",
      "args": ["C:\\ruta\\mcp-datos-gob-es\\dist\\index.js", "--stdio"]
    }
  }
}
```

En macOS/Linux, por ejemplo:

```json
{
  "mcpServers": {
    "datos-gob-es": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/usuario/mcp-datos-gob-es/dist/index.js", "--stdio"]
    }
  }
}
```

Después de cambiar la configuración, reinicia el cliente. En el modo `stdio`, los mensajes de diagnóstico se escriben en `stderr` para no interferir con el protocolo MCP.

## Otros clientes

Cualquier cliente MCP que admita el transporte **Streamable HTTP** puede conectarse a `https://TU-WORKER.workers.dev/mcp`. Para clientes locales, usa `http://localhost:3000/mcp` o inicia el proceso con stdio. La compatibilidad con SSE depende de que el cliente aún admita el transporte SSE clásico.

## Solución de problemas

- Comprueba `GET /health` para verificar que el servidor está disponible.
- `ECONNREFUSED`: inicia el servidor local o verifica el puerto.
- No aparecen herramientas: reinicia el cliente después de editar su configuración y consulta sus logs MCP.
- Errores de API/timeout: revisa la conectividad con `https://datos.gob.es/apidata` e inténtalo de nuevo más tarde.
- En Claude `stdio`, comprueba que `command` y el archivo `dist/index.js` son rutas válidas y absolutas.
