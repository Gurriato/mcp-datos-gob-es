export interface ApiPage<T = Record<string, unknown>> {
  result?: {
    items?: T[] | T;
    totalItems?: number;
    next?: string;
    [key: string]: unknown;
  };
  items?: T[] | T;
  totalItems?: number;
  [key: string]: unknown;
}

export interface DatasetSummary {
  id: string;
  title: string;
  description: string;
  url: string;
  publisher: string | null;
  themes: string[];
  modified: string | null;
  distributions: number;
}

export interface ThemeSummary {
  id: string;
  label: string;
  uri: string;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
