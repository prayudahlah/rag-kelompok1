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

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
}
