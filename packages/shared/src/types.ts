export type Section =
  | "pembukaan"
  | "batang_tubuh"
  | "pengesahan"
  | "penjelasan";

/**
 * Metadata chunk yang tersimpan di tabel LanceDB `pdp_corpus`
 * (tanpa kolom `vector`).
 */
export interface ChunkMetadata {
  chunk_id: string;
  document_id: string;
  document_title: string;

  section: Section;

  bab: string | null;
  bab_title: string | null;
  bagian: string | null;

  pasal: string | null;
  pasal_number: number | null;

  ayat: string | null;
  ayat_number: number | null;

  angka: number | null;

  page_start: number;
  page_end: number;

  text: string;

  parent_id: string | null;
  context_header: string | null;

  source: string;
  document_type: string;
  doc_number: number;
  doc_year: number;
  corpus_version: string;
  content_type: string;

  embedding_model: string;
  embedding_dimension: number;
}

export type SearchMode = "hybrid" | "vector" | "fts";

export interface SearchFilters {
  document_id?: string;
  section?: Section;
  pasal_number?: number;
}

export interface RetrievedChunk extends ChunkMetadata {
  distance: number | null;
}

export interface SearchOutcome {
  mode: SearchMode;
  usedFallback: boolean;
  notice: string | null;
  results: RetrievedChunk[];
}
