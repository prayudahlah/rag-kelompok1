import {
  lancedb,
  openCorpusTable,
} from "@rag/shared";

import type {
  ChunkMetadata,
  RetrievedChunk,
  SearchFilters,
  SearchMode,
  SearchOutcome,
} from "@rag/shared";

import { config } from "../config.js";
import { embedQuery } from "./embedQuery.js";

const SELECT_COLUMNS = [
  "chunk_id",
  "document_id",
  "document_title",
  "section",
  "bab",
  "bab_title",
  "bagian",
  "pasal",
  "pasal_number",
  "ayat",
  "ayat_number",
  "angka",
  "page_start",
  "page_end",
  "text",
  "parent_id",
  "context_header",
  "source",
  "document_type",
  "doc_number",
  "doc_year",
  "corpus_version",
  "content_type",
  "embedding_model",
  "embedding_dimension",
];

let tablePromise: ReturnType<typeof openCorpusTable> | null =
  null;

export function getTable() {
  if (!tablePromise) {
    tablePromise = openCorpusTable({
      dbPath: config.dbPath,
      tableName: config.tableName,
    });
  }

  return tablePromise;
}

let rrfPromise: ReturnType<
  typeof lancedb.rerankers.RRFReranker.create
> | null = null;

function getRrf() {
  if (!rrfPromise) {
    rrfPromise = lancedb.rerankers.RRFReranker.create();
  }

  return rrfPromise;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function buildWhere(
  filters?: SearchFilters,
): string | null {
  if (!filters) {
    return null;
  }

  const clauses: string[] = [];

  if (filters.document_id) {
    clauses.push(
      `document_id = '${escapeSql(filters.document_id)}'`,
    );
  }

  if (filters.section) {
    clauses.push(
      `section = '${escapeSql(filters.section)}'`,
    );
  }

  if (
    typeof filters.pasal_number === "number"
  ) {
    clauses.push(
      `pasal_number = ${Math.trunc(filters.pasal_number)}`,
    );
  }

  return clauses.length > 0
    ? clauses.join(" AND ")
    : null;
}

function toResult(
  row: Record<string, unknown>,
): RetrievedChunk {
  const distance = row._distance;

  return {
    ...(row as unknown as ChunkMetadata),
    distance:
      typeof distance === "number" ? distance : null,
  };
}

export interface SearchOptions {
  query: string;
  k: number;
  mode: SearchMode;
  filters?: SearchFilters;
}

export async function search(
  options: SearchOptions,
): Promise<SearchOutcome> {
  const table = await getTable();

  const where = buildWhere(options.filters);

  let mode = options.mode;
  let usedFallback = false;
  let notice: string | null = null;

  let vector: number[] | null = null;

  if (mode !== "fts") {
    try {
      const embedded = await embedQuery(options.query);
      vector = embedded.vector;

      if (embedded.cached) {
        notice = "query embedding dari cache";
      }
    } catch (error) {
      usedFallback = true;
      mode = "fts";
      notice =
        "Embedding query gagal (kemungkinan kuota API). " +
        `Fallback ke pencarian FTS. Detail: ${(error as Error).message}`;
    }
  }

  let rows: Record<string, unknown>[];

  if (mode === "hybrid" && vector) {
    const base = table
      .query()
      .fullTextSearch(options.query);

    const filtered = where ? base.where(where) : base;

    rows = (await filtered
      .nearestTo(vector)
      .limit(options.k)
      .rerank(await getRrf())
      .select(SELECT_COLUMNS)
      .toArray()) as Record<string, unknown>[];
  } else if (mode === "vector" && vector) {
    const base = table.query();

    const filtered = where ? base.where(where) : base;

    rows = (await filtered
      .nearestTo(vector)
      .limit(options.k)
      .select(SELECT_COLUMNS)
      .toArray()) as Record<string, unknown>[];
  } else {
    const base = table
      .query()
      .fullTextSearch(options.query);

    const filtered = where ? base.where(where) : base;

    rows = (await filtered
      .limit(options.k)
      .select(SELECT_COLUMNS)
      .toArray()) as Record<string, unknown>[];
  }

  return {
    mode,
    usedFallback,
    notice,
    results: rows.map(toResult),
  };
}
