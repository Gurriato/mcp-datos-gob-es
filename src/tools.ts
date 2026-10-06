import { datosGobEsClient, extractItems } from './api-client.js';
import type { ApiPage, DatasetSummary, ThemeSummary, ToolResult } from './types.js';

export const SERVER_INFO = {
  name: 'mcp-datos-gob-es',
  version: '1.0.0',
  description: 'Servidor MCP para explorar el Catálogo Nacional de Datos Abiertos de datos.gob.es.',
};

export const SERVER_INSTRUCTIONS = `Este servidor permite explorar el Catálogo Nacional de Datos Abiertos de España (datos.gob.es).

Flujo recomendado:
1. Busca conjuntos de datos con datos_gob_es_buscar_datasets o consulta datos_gob_es_listar_temas.
2. Para acotar por sector, usa datos_gob_es_buscar_por_tema con el identificador de tema devuelto por la API.
3. Consulta los metadatos completos con datos_gob_es_obtener_dataset usando el ID del catálogo.
4. Usa datos_gob_es_resumen_catalogo para obtener los totales publicados por el catálogo mediante SPARQL.

El catálogo describe conjuntos de datos y sus distribuciones; no implica necesariamente que la API descargue o analice los ficheros de cada distribución. Comprueba siempre las licencias y condiciones indicadas en la ficha original.`;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const pageProperties = {
  limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Resultados por página (1-50).' },
  page: { type: 'integer', minimum: 0, default: 0, description: 'Número de página, empezando por 0.' },
};

export const tools: ToolDefinition[] = [
  {
    name: 'datos_gob_es_buscar_datasets',
    description: 'Busca conjuntos de datos del catálogo por palabras del título. Devuelve títulos, descripciones, IDs y enlaces a las fichas. Para términos amplios, prueba varios términos o limita resultados con page y limit.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, description: 'Palabra o frase que se buscará en los títulos, por ejemplo «calidad del aire» o «contratos».' },
        ...pageProperties,
      },
      required: ['query'],
    },
  },
  {
    name: 'datos_gob_es_listar_temas',
    description: 'Lista las temáticas disponibles en el catálogo, con sus identificadores para buscar conjuntos de datos por tema.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'datos_gob_es_buscar_por_tema',
    description: 'Busca conjuntos de datos asociados a un tema del catálogo. Obtén primero el identificador con datos_gob_es_listar_temas.',
    inputSchema: {
      type: 'object',
      properties: {
        theme_id: { type: 'string', minLength: 1, description: 'Identificador URI corto del tema, por ejemplo «salud»; también se admite su URI completa.' },
        ...pageProperties,
      },
      required: ['theme_id'],
    },
  },
  {
    name: 'datos_gob_es_obtener_dataset',
    description: 'Recupera la ficha detallada de un conjunto de datos por su ID: descripción, organismo publicador, temas, palabras clave, fechas, licencia, cobertura y distribuciones disponibles.',
    inputSchema: {
      type: 'object',
      properties: {
        dataset_id: { type: 'string', minLength: 1, description: 'ID del conjunto de datos, normalmente la última parte de la URL de catálogo.' },
      },
      required: ['dataset_id'],
    },
  },
  {
    name: 'datos_gob_es_resumen_catalogo',
    description: 'Obtiene los totales publicados por datos.gob.es mediante una consulta SPARQL agregada: conjuntos de datos, distribuciones, organismos publicadores y temáticas.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type ToolArguments = Record<string, unknown>;

export async function runTool(name: string, args: ToolArguments = {}): Promise<ToolResult> {
  try {
    let result: Record<string, unknown>;
    switch (name) {
      case 'datos_gob_es_buscar_datasets': {
        const query = requiredString(args, 'query');
        const limit = boundedInteger(args.limit, 10, 1, 50, 'limit');
        const page = boundedInteger(args.page, 0, 0, 100_000, 'page');
        const payload = await datosGobEsClient.searchDatasets(query, limit, page);
        result = formatDatasetPage(payload, page, limit);
        break;
      }
      case 'datos_gob_es_listar_temas': {
        const payload = await datosGobEsClient.listThemes();
        const themes = extractItems(payload)
          .map(formatTheme)
          .filter((theme) => theme.uri.includes('/kos/sector-publico/sector/'));
        result = { total: themes.length, temas: themes };
        break;
      }
      case 'datos_gob_es_buscar_por_tema': {
        const themeId = requiredString(args, 'theme_id');
        const limit = boundedInteger(args.limit, 10, 1, 50, 'limit');
        const page = boundedInteger(args.page, 0, 0, 100_000, 'page');
        const normalizedThemeId = lastPathSegment(themeId);
        const payload = await datosGobEsClient.searchByTheme(normalizedThemeId, limit, page);
        result = { tema: normalizedThemeId, ...formatDatasetPage(payload, page, limit) };
        break;
      }
      case 'datos_gob_es_obtener_dataset': {
        const datasetId = requiredString(args, 'dataset_id');
        const payload = await datosGobEsClient.getDataset(datasetId);
        const item = extractItems(payload)[0];
        if (!item) throw new Error(`No se encontró un conjunto de datos con el ID «${datasetId}».`);
        result = { conjunto_datos: formatDatasetDetail(item, datasetId) };
        break;
      }
      case 'datos_gob_es_resumen_catalogo':
        result = { fuente: 'Catálogo de datos.gob.es', ...await datosGobEsClient.getCatalogTotals() };
        break;
      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al ejecutar la herramienta.';
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}

function requiredString(args: ToolArguments, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`El parámetro «${key}» es obligatorio y debe ser texto.`);
  return value.trim();
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`El parámetro «${name}» debe ser un entero entre ${min} y ${max}.`);
  }
  return Number(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function multilang(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const entries = value.map(asRecord);
    const preferred = entries.find((entry) => entry._lang === 'es') ?? entries[0];
    return preferred ? String(preferred._value ?? fallback) : fallback;
  }
  if (value && typeof value === 'object') return String(asRecord(value)._value ?? fallback);
  return value === undefined || value === null ? fallback : String(value);
}

function lastPathSegment(value: unknown): string {
  const input = typeof value === 'string' ? value : '';
  return input.replace(/\/$/, '').split('/').pop() ?? '';
}

function list(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function formatTheme(raw: unknown): ThemeSummary {
  if (typeof raw === 'string') {
    const id = lastPathSegment(raw);
    return { id, label: id.replace(/[-_]/g, ' '), uri: raw };
  }
  const item = asRecord(raw);
  const uri = String(item._about ?? item.uri ?? '');
  return {
    id: lastPathSegment(uri || item.id),
    label: multilang(item.label ?? item.prefLabel ?? item.title, lastPathSegment(uri)),
    uri,
  };
}

function formatDataset(raw: unknown): DatasetSummary {
  const item = asRecord(raw);
  const uri = String(item._about ?? '');
  const themes = list(item.theme).map((theme) => {
    if (typeof theme === 'string') return lastPathSegment(theme);
    const themeRecord = asRecord(theme);
    return multilang(themeRecord.label, lastPathSegment(themeRecord._about));
  }).filter(Boolean);
  const publisher = item.publisher;
  const publisherName = publisher && typeof publisher === 'object'
    ? multilang(asRecord(publisher).name, '')
    : typeof publisher === 'string' ? lastPathSegment(publisher) : '';

  return {
    id: lastPathSegment(uri || item.identifier),
    title: multilang(item.title, 'Sin título'),
    description: multilang(item.description, 'Sin descripción'),
    url: uri || `https://datos.gob.es/es/catalogo/${lastPathSegment(item.identifier)}`,
    publisher: publisherName || null,
    themes,
    modified: typeof item.modified === 'string' ? item.modified : null,
    distributions: list(item.distribution).length,
  };
}

function formatDatasetPage(payload: ApiPage, page: number, limit: number): Record<string, unknown> {
  const datasets = extractItems(payload).map(formatDataset);
  return {
    pagina: page,
    resultados_por_pagina: limit,
    resultados_en_pagina: datasets.length,
    hay_mas_resultados: Boolean(payload.result?.next),
    conjuntos_datos: datasets,
  };
}

function formatDatasetDetail(raw: unknown, requestedId: string): Record<string, unknown> {
  const item = asRecord(raw);
  const summary = formatDataset(item);
  const temporal = asRecord(item.temporal);
  const keywords = list(item.keyword).map((keyword) => multilang(keyword)).filter(Boolean);
  const distributions = list(item.distribution).map((value) => {
    const distribution = asRecord(value);
    const format = asRecord(distribution.format);
    return {
      titulo: multilang(distribution.title, 'Sin título'),
      formato: multilang(format.value ?? distribution.format, 'Desconocido'),
      url: String(distribution.accessURL ?? distribution.downloadURL ?? ''),
      tamano_bytes: distribution.byteSize ?? null,
    };
  });
  const spatial = list(item.spatial).map((value) => typeof value === 'string' ? lastPathSegment(value) : lastPathSegment(asRecord(value)._about)).filter(Boolean);

  return {
    ...summary,
    id: summary.id || requestedId,
    palabras_clave: keywords,
    fecha_publicacion: item.issued ?? null,
    licencia: multilang(asRecord(item.license).label ?? asRecord(item.license)._about ?? item.license, 'No especificada'),
    cobertura_temporal: temporal.startDate || temporal.endDate ? { inicio: temporal.startDate ?? null, fin: temporal.endDate ?? null } : null,
    cobertura_espacial: spatial,
    distribuciones_detalle: distributions,
  };
}
