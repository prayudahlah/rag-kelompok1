export interface Source {
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

export interface ChatResponse {
  answer: string;
  sources: Source[];
  rewrittenQuery?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export type AppMode = "mock" | "live";
export type ActivePage = "chat" | "riwayat" | "tentang";

export interface HistorySession {
  id: string;
  title: string;
  timestamp: string;
  messages: Message[];
}
