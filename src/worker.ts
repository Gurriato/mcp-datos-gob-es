import { runTool, SERVER_INFO, SERVER_INSTRUCTIONS, tools } from './tools.js';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version, X-Request-Id',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};

interface JsonRpcMessage {
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
  id?: unknown;
}

interface SseConnection {
  send: (event: string, data: string) => void;
}

interface DurableObjectIdLike {
  toString(): string;
}

interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  newUniqueId(): DurableObjectIdLike;
  idFromString(id: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

export interface Env {
  SSE_SESSIONS?: DurableObjectNamespaceLike;
}

const localSseSessions = new Map<string, SseConnection>();

function json(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function error(code: number, message: string, id: unknown = null): Record<string, unknown> {
  return { jsonrpc: '2.0', error: { code, message }, id };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function dispatch(message: JsonRpcMessage): Promise<{ status: number; payload: unknown; headers?: Record<string, string> }> {
  const requestId = message.id;
  const notification = requestId === undefined;
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return { status: 400, payload: error(-32600, 'Invalid Request: jsonrpc debe ser "2.0" y method una cadena.', requestId) };
  }

  const params = isRecord(message.params) ? message.params : {};
  const method = message.method;
  if (notification) {
    if (method.startsWith('notifications/')) return { status: 202, payload: null };
    return { status: 400, payload: error(-32600, 'Una solicitud JSON-RPC debe incluir id.') };
  }

  const requestedVersion = typeof params.protocolVersion === 'string' ? params.protocolVersion : undefined;
  const supportedVersions = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
  const protocolVersion = requestedVersion && supportedVersions.includes(requestedVersion)
    ? requestedVersion
    : '2024-11-05';
  const protocolHeader = { 'MCP-Protocol-Version': protocolVersion };

  switch (method) {
    case 'initialize':
      return {
        status: 200,
        payload: {
          jsonrpc: '2.0',
          id: requestId,
          result: {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: SERVER_INFO.name, version: SERVER_INFO.version },
            instructions: SERVER_INSTRUCTIONS,
          },
        },
        headers: protocolHeader,
      };
    case 'ping':
      return { status: 200, payload: { jsonrpc: '2.0', id: requestId, result: {} }, headers: protocolHeader };
    case 'tools/list':
      return { status: 200, payload: { jsonrpc: '2.0', id: requestId, result: { tools } }, headers: protocolHeader };
    case 'tools/call': {
      if (typeof params.name !== 'string') {
        return { status: 200, payload: error(-32602, 'Invalid params: name de herramienta es obligatorio.', requestId), headers: protocolHeader };
      }
      if (params.arguments !== undefined && !isRecord(params.arguments)) {
        return { status: 200, payload: error(-32602, 'Invalid params: arguments debe ser un objeto.', requestId), headers: protocolHeader };
      }
      const result = await runTool(params.name, (params.arguments as Record<string, unknown> | undefined) ?? {});
      return { status: 200, payload: { jsonrpc: '2.0', id: requestId, result }, headers: protocolHeader };
    }
    case 'resources/list':
      return { status: 200, payload: { jsonrpc: '2.0', id: requestId, result: { resources: [] } }, headers: protocolHeader };
    case 'prompts/list':
      return { status: 200, payload: { jsonrpc: '2.0', id: requestId, result: { prompts: [] } }, headers: protocolHeader };
    default:
      return { status: 200, payload: error(-32601, `Method not found: ${method}`, requestId), headers: protocolHeader };
  }
}

async function handleMcpPost(request: Request): Promise<Response> {
  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return json(error(-32700, 'Parse error: el cuerpo no contiene JSON válido.'), 400);
  }
  if (!isRecord(message)) return json(error(-32600, 'Invalid Request: se esperaba un objeto JSON-RPC.'), 400);

  try {
    const outcome = await dispatch(message as JsonRpcMessage);
    if (outcome.status === 202 || outcome.payload === null) return new Response(null, { status: 202, headers: CORS_HEADERS });
    return json(outcome.payload, outcome.status, outcome.headers);
  } catch (cause) {
    const messageText = cause instanceof Error ? cause.message : 'Error interno del servidor.';
    return json(error(-32603, messageText, (message as JsonRpcMessage).id), 200);
  }
}

function createSseResponse(sessionId: string): Response {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) { controller = streamController; },
    cancel() { localSseSessions.delete(sessionId); },
  });
  localSseSessions.set(sessionId, {
    send(event, data) {
      try { controller?.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`)); } catch { localSseSessions.delete(sessionId); }
    },
  });
  localSseSessions.get(sessionId)?.send('endpoint', `/message?sessionId=${encodeURIComponent(sessionId)}`);
  return new Response(stream, {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}

async function handleSseMessage(request: Request, url: URL): Promise<Response> {
  const sessionId = url.searchParams.get('sessionId');
  const session = sessionId ? localSseSessions.get(sessionId) : undefined;
  if (!session) return json({ error: 'No existe una sesión SSE activa. Abre primero GET /sse.' }, 404);
  let message: unknown;
  try { message = await request.json(); } catch { return json(error(-32700, 'Parse error.'), 400); }
  if (!isRecord(message)) return json(error(-32600, 'Invalid Request.'), 400);
  const outcome = await dispatch(message as JsonRpcMessage);
  if (outcome.payload !== null && outcome.status !== 202) session.send('message', JSON.stringify(outcome.payload));
  return new Response(null, { status: 202, headers: CORS_HEADERS });
}

/**
 * Cloudflare routes each session through a Durable Object so the SSE stream
 * and its POST messages always reach the same stateful instance.
 */
export class SseSessionDO {
  private readonly sessionId: string;
  private controller?: ReadableStreamDefaultController<Uint8Array>;

  constructor(state: { id: { toString(): string } }) {
    this.sessionId = state.id.toString();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/sse') return this.openStream();
    if (request.method === 'POST' && url.pathname === '/message') return this.handleMessage(request);
    return json({ error: 'Not Found' }, 404);
  }

  private openStream(): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
        controller.enqueue(encoder.encode(`event: endpoint\ndata: /message?sessionId=${encodeURIComponent(this.sessionId)}\n\n`));
      },
      cancel: () => { this.controller = undefined; },
    });
    return new Response(stream, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
    });
  }

  private async handleMessage(request: Request): Promise<Response> {
    let message: unknown;
    try { message = await request.json(); } catch { return json(error(-32700, 'Parse error.'), 400); }
    if (!isRecord(message)) return json(error(-32600, 'Invalid Request.'), 400);

    try {
      const outcome = await dispatch(message as JsonRpcMessage);
      if (outcome.payload !== null && outcome.status !== 202) {
        this.controller?.enqueue(new TextEncoder().encode(`event: message\ndata: ${JSON.stringify(outcome.payload)}\n\n`));
      }
      return new Response(null, { status: 202, headers: CORS_HEADERS });
    } catch (cause) {
      const messageText = cause instanceof Error ? cause.message : 'Error interno del servidor.';
      const payload = error(-32603, messageText, (message as JsonRpcMessage).id);
      this.controller?.enqueue(new TextEncoder().encode(`event: message\ndata: ${JSON.stringify(payload)}\n\n`));
      return new Response(null, { status: 202, headers: CORS_HEADERS });
    }
  }
}

async function handleDurableSse(
  request: Request,
  url: URL,
  namespace: DurableObjectNamespaceLike,
): Promise<Response> {
  if (request.method === 'GET') {
    const id = namespace.newUniqueId();
    return namespace.get(id).fetch(new Request('https://sse-session/sse'));
  }

  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return json({ error: 'Falta el parámetro sessionId.' }, 400);
  let id: DurableObjectIdLike;
  try { id = namespace.idFromString(sessionId); } catch { return json({ error: 'El sessionId no es válido.' }, 400); }
  const body = await request.arrayBuffer();
  return namespace.get(id).fetch(new Request('https://sse-session/message', {
    method: 'POST',
    headers: request.headers,
    body,
  }));
}

function health(): Response {
  return json({
    status: 'ok',
    service: SERVER_INFO.name,
    version: SERVER_INFO.version,
    transports: ['Streamable HTTP', 'SSE'],
    tools: tools.length,
    endpoints: { mcp: 'POST /mcp', sse: 'GET /sse', health: 'GET /health' },
  });
}

function landing(request: Request): Response {
  const host = new URL(request.url).host;
  const origin = `${new URL(request.url).protocol}//${host}`;
  const body = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MCP datos.gob.es</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:3rem auto;padding:0 1rem;color:#172033}h1{color:#176b87}code,pre{background:#f1f5f9;border-radius:5px;padding:.2rem .4rem}pre{padding:1rem;overflow:auto}a{color:#086788}</style></head>
<body><h1>MCP datos.gob.es</h1><p>Servidor Model Context Protocol para descubrir conjuntos de datos abiertos del catálogo nacional de España.</p>
<h2>Conectar por Streamable HTTP</h2><p>Endpoint MCP: <code>${origin}/mcp</code></p>
<h3>opencode</h3><pre>{
  "mcp": {
    "datos-gob-es": {
      "type": "remote",
      "url": "${origin}/mcp",
      "enabled": true
    }
  }
}</pre>
<h3>Claude Desktop (SSE clásico)</h3><pre>{
  "mcpServers": {
    "datos-gob-es": {
      "url": "${origin}/sse",
      "transport": "sse"
    }
  }
}</pre>
<h2>Endpoints</h2><ul><li><code>POST /mcp</code> — MCP Streamable HTTP</li><li><code>GET /sse</code> y <code>POST /message</code> — transporte SSE clásico</li><li><code>GET /health</code> — estado del servicio</li></ul>
<p>Fuente: <a href="https://datos.gob.es/es/apidata">API pública de datos.gob.es</a>. <a href="https://github.com/Gurriato/mcp-datos-gob-es">Código y documentación</a>.</p></body></html>`;
  return new Response(body, { headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
}

const worker = {
  async fetch(request: Request, env?: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    if (method === 'POST' && ['/mcp', '/mcp/'].includes(url.pathname)) return handleMcpPost(request);
    if (method === 'GET' && ['/sse', '/sse/'].includes(url.pathname)) {
      return env?.SSE_SESSIONS
        ? handleDurableSse(request, url, env.SSE_SESSIONS)
        : createSseResponse(crypto.randomUUID());
    }
    if (method === 'POST' && ['/message', '/message/'].includes(url.pathname)) {
      return env?.SSE_SESSIONS
        ? handleDurableSse(request, url, env.SSE_SESSIONS)
        : handleSseMessage(request, url);
    }
    if (method === 'GET' && ['/health', '/health/'].includes(url.pathname)) return health();
    if (method === 'GET' && url.pathname === '/') return landing(request);
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      return json({ error: 'El endpoint MCP acepta POST. Para SSE clásico, conecta con GET /sse.' }, 405, { Allow: 'POST, OPTIONS' });
    }
    return json({ error: 'Not Found' }, 404);
  },
};

export default worker;
