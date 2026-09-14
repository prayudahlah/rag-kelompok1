export type Section =
  | "pembukaan"
  | "batang_tubuh"
  | "pengesahan"
  | "penjelasan";

export type SearchMode = "hybrid" | "vector" | "fts";

export interface Source {
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
  distance: number | null;
}

export interface Citation {
  marker: string;
  chunk_id: string;
  label: string;
  document_id: string;
  section: Section;
  pasal: string | null;
  ayat: string | null;
  page_start: number;
  page_end: number;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  sources: Source[];
  mode: SearchMode;
  usedFallback: boolean;
  notice: string | null;
  retrieval_query: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  citations?: Citation[];
  usedFallback?: boolean;
  notice?: string | null;
  timestamp: Date;
}

export type ActivePage = "chat" | "riwayat" | "tentang";

export interface HistorySession {
  id: string;
  title: string;
  timestamp: string;
  messages: Message[];
}
