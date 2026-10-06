import { createServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import worker from './worker.js';
import { runTool, SERVER_INFO, tools } from './tools.js';

async function runStdio(): Promise<void> {
  const server = new Server(
    { name: SERVER_INFO.name, version: SERVER_INFO.version },
    { capabilities: { tools: { listChanged: false } } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    await runTool(request.params.name, request.params.arguments ?? {}) as CallToolResult,
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function readBody(request: import('node:http').IncomingMessage): Promise<string | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function runHttp(): Promise<void> {
  const port = Number.parseInt(process.env.MCP_PORT ?? '3000', 10);
  const host = process.env.MCP_HOST ?? '0.0.0.0';
  const httpServer = createServer(async (incoming, outgoing) => {
    try {
      const protocol = incoming.headers['x-forwarded-proto'] ?? 'http';
      const hostHeader = incoming.headers.host ?? `localhost:${port}`;
      const url = `${protocol}://${hostHeader}${incoming.url ?? '/'}`;
      const body = await readBody(incoming);
      const request = new Request(url, {
        method: incoming.method,
        headers: incoming.headers as HeadersInit,
        body,
      });
      const response = await worker.fetch(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          outgoing.write(value);
        }
      }
      outgoing.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'content-type': 'application/json' });
      outgoing.end(JSON.stringify({ error: message }));
    }
  });

  httpServer.listen(port, host, () => {
    console.error(`MCP datos.gob.es escuchando en http://${host}:${port}`);
    console.error(`Endpoint MCP: http://localhost:${port}/mcp`);
    console.error(`Health check: http://localhost:${port}/health`);
  });
}

if (process.argv.includes('--stdio')) {
  await runStdio();
} else {
  await runHttp();
}
