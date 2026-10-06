import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import worker, { SseSessionDO } from '../dist/worker.js';

async function rpc(method, params = {}, id = 1) {
  const response = await worker.fetch(new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
  }));
  return { response, body: response.status === 202 ? null : await response.json() };
}

const health = await worker.fetch(new Request('http://localhost/health'));
assert.equal(health.status, 200);
assert.equal((await health.json()).tools, 5);

const initialized = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'smoke-test', version: '1.0' } });
assert.equal(initialized.response.status, 200);
assert.equal(initialized.body.result.serverInfo.name, 'mcp-datos-gob-es');
assert.equal(initialized.body.result.protocolVersion, '2025-11-25');

const listing = await rpc('tools/list');
assert.equal(listing.body.result.tools.length, 5);
assert.ok(listing.body.result.tools.some((tool) => tool.name === 'datos_gob_es_buscar_datasets'));

const invalid = await rpc('tools/call', { name: 'datos_gob_es_buscar_datasets', arguments: { query: 'clima', limit: 100 } });
assert.equal(invalid.body.result.isError, true);

const unknown = await rpc('tools/call', { name: 'tool_that_does_not_exist', arguments: {} });
assert.equal(unknown.body.result.isError, true);

const notification = await worker.fetch(new Request('http://localhost/mcp', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
}));
assert.equal(notification.status, 202);

const sse = await worker.fetch(new Request('http://localhost/sse'));
assert.equal(sse.status, 200);
const sseReader = sse.body.getReader();
const endpointEvent = new TextDecoder().decode((await sseReader.read()).value);
const sessionId = new URL(`http://localhost${endpointEvent.match(/data: (.+)\n/)?.[1]}`).searchParams.get('sessionId');
assert.ok(sessionId);
const ssePost = await worker.fetch(new Request(`http://localhost/message?sessionId=${sessionId}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 8 }),
}));
assert.equal(ssePost.status, 202);
const messageEvent = new TextDecoder().decode((await sseReader.read()).value);
assert.match(messageEvent, /"method":"ping"|"result":\{\}/);
await sseReader.cancel();

const durableSessions = new Map();
const durableNamespace = {
  newUniqueId: () => ({ toString: () => 'durable-session-smoke' }),
  idFromString: (id) => ({ toString: () => id }),
  get: (id) => {
    const sessionId = id.toString();
    if (!durableSessions.has(sessionId)) durableSessions.set(sessionId, new SseSessionDO({ id }));
    return { fetch: (request) => durableSessions.get(sessionId).fetch(request) };
  },
};
const durableEnv = { SSE_SESSIONS: durableNamespace };
const durableSse = await worker.fetch(new Request('http://localhost/sse'), durableEnv);
const durableReader = durableSse.body.getReader();
const durableEndpoint = new TextDecoder().decode((await durableReader.read()).value);
const durableSessionId = new URL(`http://localhost${durableEndpoint.match(/data: ([^\r\n]+)/)?.[1]}`).searchParams.get('sessionId');
const durablePost = await worker.fetch(new Request(`http://localhost/message?sessionId=${durableSessionId}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 9 }),
}), durableEnv);
assert.equal(durablePost.status, 202);
const durableMessage = new TextDecoder().decode((await durableReader.read()).value);
assert.match(durableMessage, /"id":9,"result":\{\}/);
await durableReader.cancel();

const serverPath = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const stdioTransport = new StdioClientTransport({ command: process.execPath, args: [serverPath, '--stdio'] });
const stdioClient = new Client({ name: 'mcp-datos-gob-es-smoke', version: '1.0.0' }, { capabilities: {} });
await stdioClient.connect(stdioTransport);
const stdioTools = await stdioClient.listTools();
assert.equal(stdioTools.tools.length, 5);
await stdioClient.close();

const port = 31_000 + Math.floor(Math.random() * 1_000);
const localServer = spawn(process.execPath, [serverPath], {
  env: { ...process.env, MCP_HOST: '127.0.0.1', MCP_PORT: String(port) },
  stdio: 'ignore',
});
try {
  let localHealth;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      localHealth = await fetch(`http://127.0.0.1:${port}/health`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal(localHealth?.status, 200, 'El servidor HTTP local debe arrancar y servir /health.');
  const localRpc = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 9 }),
  });
  assert.equal((await localRpc.json()).result.tools.length, 5);
} finally {
  localServer.kill();
}

const live = process.argv.includes('--live');
if (live) {
  const search = await rpc('tools/call', { name: 'datos_gob_es_buscar_datasets', arguments: { query: 'clima', limit: 2 } });
  assert.equal(search.body.result.isError, undefined, search.body.result.content?.[0]?.text);
  const data = search.body.result.structuredContent;
  assert.ok(data.conjuntos_datos.length > 0, 'La API real debe devolver al menos un conjunto de datos sobre clima.');
  console.log(`Prueba real correcta: se recibieron ${data.conjuntos_datos.length} resultados para «clima».`);
  const themes = await rpc('tools/call', { name: 'datos_gob_es_listar_temas', arguments: {} });
  assert.ok(themes.body.result.structuredContent.temas.length > 0, 'La API real debe devolver temas utilizables para filtrar datasets.');
  assert.ok(themes.body.result.structuredContent.temas.some((theme) => theme.id === 'medio-ambiente'));
  const byTheme = await rpc('tools/call', { name: 'datos_gob_es_buscar_por_tema', arguments: { theme_id: 'medio-ambiente', limit: 2 } });
  assert.ok(byTheme.body.result.structuredContent.conjuntos_datos.length > 0, 'La búsqueda por un tema devuelto debe hallar resultados.');
  const summary = await rpc('tools/call', { name: 'datos_gob_es_resumen_catalogo', arguments: {} });
  assert.ok(summary.body.result.structuredContent.datasets > 0, 'SPARQL debe devolver el recuento de conjuntos de datos.');
  assert.ok(summary.body.result.structuredContent.distributions > 0, 'SPARQL debe devolver el recuento de distribuciones.');
  console.log(`Resumen SPARQL correcto: ${summary.body.result.structuredContent.datasets} conjuntos de datos.`);
}

console.log(`Smoke tests MCP correctos (${live ? 'incluye consultas en vivo' : 'sin dependencias de red'}).`);
