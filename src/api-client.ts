import type { ApiPage } from './types.js';

const DEFAULT_BASE_URL = 'https://datos.gob.es/apidata';
const MAX_CACHE_ENTRIES = 200;

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();

function getCache(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key: string, value: unknown, ttlMs: number): void {
  if (ttlMs <= 0) return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export class DatosGobEsClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;

  constructor(options: { baseUrl?: string; timeoutMs?: number; cacheTtlMs?: number } = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, '')}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const cacheKey = url.toString();
    const cached = getCache(cacheKey);
    if (cached !== undefined) return cached as T;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'es, en;q=0.8',
          'User-Agent': 'mcp-datos-gob-es/1.0 (+https://github.com/Gurriato/mcp-datos-gob-es)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const statusMessage = response.status === 404
          ? 'No se ha encontrado el recurso solicitado. Comprueba el identificador o usa primero la herramienta de búsqueda.'
          : response.status === 429
            ? 'La API ha limitado temporalmente las solicitudes. Inténtalo de nuevo más tarde.'
            : `La API de datos.gob.es ha respondido con HTTP ${response.status}.`;
        throw new Error(statusMessage);
      }

      const data = await response.json() as T;
      setCache(cacheKey, data, this.cacheTtlMs);
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`La API de datos.gob.es no respondió en ${this.timeoutMs} ms.`);
      }
      throw error instanceof Error ? error : new Error('Error desconocido consultando datos.gob.es.');
    } finally {
      clearTimeout(timeout);
    }
  }

  searchDatasets(query: string, limit: number, page: number): Promise<ApiPage> {
    return this.get(`catalog/dataset/title/${encodeURIComponent(query)}.json`, {
      _pageSize: limit,
      _page: page,
    });
  }

  async listThemes(): Promise<ApiPage<unknown>> {
    const items: unknown[] = [];
    let page = 0;
    let lastPage: ApiPage<unknown> = {};
    do {
      lastPage = await this.get<ApiPage<unknown>>('catalog/theme.json', { _pageSize: 50, _page: page });
      items.push(...extractItems(lastPage));
      page += 1;
    } while (lastPage.result?.next && page < 20);

    return { result: { ...lastPage.result, items } };
  }

  searchByTheme(themeId: string, limit: number, page: number): Promise<ApiPage> {
    return this.get(`catalog/dataset/theme/${encodeURIComponent(themeId)}.json`, {
      _pageSize: limit,
      _page: page,
    });
  }

  getDataset(datasetId: string): Promise<ApiPage> {
    return this.get(`catalog/dataset/${encodeURIComponent(datasetId)}.json`);
  }

  async getCatalogTotals(): Promise<Record<string, number>> {
    const query = `PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>
SELECT (COUNT(DISTINCT ?dataset) AS ?datasets)
       (COUNT(DISTINCT ?distribution) AS ?distributions)
       (COUNT(DISTINCT ?publisher) AS ?publishers)
       (COUNT(DISTINCT ?theme) AS ?themes)
WHERE {
  GRAPH <http://datos.gob.es/catalogo> {
    ?dataset a dcat:Dataset .
    OPTIONAL { ?dataset dct:publisher ?publisher }
    OPTIONAL { ?dataset dcat:distribution ?distribution }
    OPTIONAL { ?dataset dcat:theme ?theme }
  }
}`;
    const url = new URL('https://datos.gob.es/virtuoso/sparql');
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'application/sparql-results+json');
    const cacheKey = url.toString();
    const cached = getCache(cacheKey);
    if (cached !== undefined) return cached as Record<string, number>;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'mcp-datos-gob-es/1.0' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`El punto SPARQL de datos.gob.es ha respondido con HTTP ${response.status}.`);
      const data = await response.json() as {
        results?: { bindings?: Array<Record<string, { value?: string }>> };
      };
      const binding = data.results?.bindings?.[0] ?? {};
      const totals = Object.fromEntries(['datasets', 'distributions', 'publishers', 'themes'].map((key) => [
        key,
        Number.parseInt(binding[key]?.value ?? '0', 10) || 0,
      ]));
      setCache(cacheKey, totals, this.cacheTtlMs);
      return totals;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`El punto SPARQL de datos.gob.es no respondió en ${this.timeoutMs} ms.`);
      }
      throw error instanceof Error ? error : new Error('Error desconocido consultando el punto SPARQL.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const datosGobEsClient = new DatosGobEsClient({
  baseUrl: typeof process !== 'undefined' ? process.env.DATOS_GOB_ES_API_BASE : undefined,
  timeoutMs: readPositiveInteger(typeof process !== 'undefined' ? process.env.DATOS_GOB_ES_TIMEOUT_MS : undefined, 15_000),
  cacheTtlMs: readPositiveInteger(typeof process !== 'undefined' ? process.env.DATOS_GOB_ES_CACHE_TTL_MS : undefined, 300_000),
});

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function extractItems<T = Record<string, unknown>>(payload: ApiPage<T>): T[] {
  const items = payload.result?.items ?? payload.items ?? [];
  if (items === null || items === undefined) return [];
  return Array.isArray(items) ? items : [items];
}
