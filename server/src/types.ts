export interface SourceChunk {
  chunk_id: string;
  pasal: string;
  pasal_number: number | null;
  ayat: string | null;
  ayat_number: number | null;
  text: string;
  page_start: number;
  bab: string | null;
  bab_title: string | null;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  question: string;
  history?: HistoryMessage[];
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  rewrittenQuery?: string;
}
