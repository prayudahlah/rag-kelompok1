import * as lancedb from "@lancedb/lancedb";
import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";
import type { SourceChunk } from "./types.js";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSION = 768;
const TOP_K = 5;

export async function retrieve(query: string): Promise<SourceChunk[]> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  const embedResult = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [query],
    config: {
      outputDimensionality: EMBEDDING_DIMENSION,
    },
  });

  const queryEmbedding = embedResult.embeddings?.[0]?.values;

  if (!queryEmbedding || queryEmbedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Embedding query gagal: dimensi ${queryEmbedding?.length ?? 0} (expected ${EMBEDDING_DIMENSION})`,
    );
  }

  const db = await lancedb.connect(config.lancedbPath);
  const table = await db.openTable("uu27_2022");

  const results = await table
    .vectorSearch(queryEmbedding)
    .limit(TOP_K)
    .toArray();

  return results.map((row) => ({
    chunk_id: String(row.chunk_id),
    pasal: String(row.pasal ?? ""),
    pasal_number: row.pasal_number != null ? Number(row.pasal_number) : null,
    ayat: row.ayat != null ? String(row.ayat) : null,
    ayat_number: row.ayat_number != null ? Number(row.ayat_number) : null,
    text: String(row.text ?? ""),
    page_start: Number(row.page_start ?? 0),
    bab: row.bab != null ? String(row.bab) : null,
    bab_title: row.bab_title != null ? String(row.bab_title) : null,
  }));
}
