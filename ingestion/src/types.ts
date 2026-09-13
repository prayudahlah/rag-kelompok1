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
