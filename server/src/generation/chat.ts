import type {
  RetrievedChunk,
  SearchFilters,
  SearchMode,
} from "@rag/shared";

import { config } from "../config.js";
import { search } from "../retrieval/search.js";

import {
  buildPrompt,
  SYSTEM_INSTRUCTION,
} from "./prompt.js";
import {
  getGenAIClient,
  getResponseText,
} from "./gemini.js";
import { rewriteQuery } from "./rewriteQuery.js";

import type { ChatMessage } from "./prompt.js";

export interface Citation {
  marker: string;
  chunk_id: string;
  label: string;
  document_id: string;
  section: string;
  pasal: string | null;
  ayat: string | null;
  page_start: number;
  page_end: number;
}

export interface ChatOptions {
  messages: ChatMessage[];
  k: number;
  mode: SearchMode;
  filters?: SearchFilters;
}

export interface ChatOutcome {
  answer: string;
  citations: Citation[];
  sources: RetrievedChunk[];
  mode: SearchMode;
  usedFallback: boolean;
  notice: string | null;
  retrieval_query: string;
}

function extractCitations(
  answer: string,
  sources: RetrievedChunk[],
): Citation[] {
  const markers = [
    ...answer.matchAll(/\[S(\d+)\]/g),
  ].map((match) => `[S${match[1]}]`);

  const unique = [...new Set(markers)];
  const citations: Citation[] = [];

  for (const marker of unique) {
    const index = Number(marker.slice(2, -1)) - 1;
    const source = sources[index];

    if (!source) {
      continue;
    }

    citations.push({
      marker,
      chunk_id: source.chunk_id,
      label: source.context_header ?? source.chunk_id,
      document_id: source.document_id,
      section: source.section,
      pasal: source.pasal,
      ayat: source.ayat,
      page_start: source.page_start,
      page_end: source.page_end,
    });
  }

  return citations;
}

async function resolveRetrievalQuery(
  messages: ChatMessage[],
  lastUserContent: string,
): Promise<string> {
  if (!config.queryRewrite) {
    return lastUserContent;
  }

  try {
    const rewritten = await rewriteQuery(messages);

    return rewritten ?? lastUserContent;
  } catch {
    return lastUserContent;
  }
}

export async function chat(
  options: ChatOptions,
): Promise<ChatOutcome> {
  const { messages, k, mode, filters } = options;

  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUser) {
    throw new Error(
      "Riwayat harus memuat minimal satu pesan dari user.",
    );
  }

  const retrievalQuery = await resolveRetrievalQuery(
    messages,
    lastUser.content,
  );

  const outcome = await search({
    query: retrievalQuery,
    k,
    mode,
    filters,
  });

  const sources = outcome.results;

  if (sources.length === 0) {
    return {
      answer:
        "Tidak ditemukan dasar yang relevan pada korpus untuk pertanyaan ini.",
      citations: [],
      sources: [],
      mode: outcome.mode,
      usedFallback: outcome.usedFallback,
      notice: outcome.notice,
      retrieval_query: retrievalQuery,
    };
  }

  const prompt = buildPrompt(
    messages,
    sources,
    config.chatMaxHistoryTurns,
  );

  const response =
    await getGenAIClient().models.generateContent({
      model: config.chatModel,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
    });

  const answer = getResponseText(response);

  return {
    answer,
    citations: extractCitations(answer, sources),
    sources,
    mode: outcome.mode,
    usedFallback: outcome.usedFallback,
    notice: outcome.notice,
    retrieval_query: retrievalQuery,
  };
}
