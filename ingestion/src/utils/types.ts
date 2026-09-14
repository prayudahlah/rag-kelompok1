export type Section = "pembukaan" | "batang_tubuh" | "pengesahan" | "penjelasan";

export interface Chunk {
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
}

export interface ValidationReport {
  totalChunks: number;
  chunksBySection: Record<string, number>;
  pasal1Chunks: number;
  babCount: number;
  babUniqueCount: number;
  babOrderOk: boolean;
  babRomanList: string[];
  pasalCount: number;
  pasalUniqueCount: number;
  pasalMissing: number[];
  emptyChunks: number;
  duplicateChunkIds: number;
  noTextLoss: boolean;
  missingTextLines: string[];
  extraTextLines: string[];
  pageProvenanceOk: boolean;
  pageProvenanceIssues: number;
}

export interface ParseOptions {
  tier: string;
  version: string;
}

export interface SourceDocument {
  document_id: string;
  doc_type: string;
  doc_number: number;
  doc_year: number;
  doc_title: string;
  status: string;
  source: string;
  source_url: string;
  parse?: ParseOptions;
  enabled?: boolean;
}

export interface CorpusSources {
  corpus_version: string;
  parse_defaults?: ParseOptions;
  documents: SourceDocument[];
}

export type ManifestStatus =
  | "missing"
  | "downloaded"
  | "verified"
  | "manual-required";

export interface ManifestEntry {
  document_id: string;
  source_url: string;
  status: ManifestStatus;
  retrieved_at: string | null;
  bytes: number | null;
  sha256: string | null;
  extracted_at?: string | null;
  extracted_sha256?: string | null;
}

export interface CorpusManifest {
  corpus_version: string;
  generated_at: string | null;
  documents: Record<string, ManifestEntry>;
}
