import "dotenv/config";

import path from "node:path";

const DEFAULT_DB_PATH = path.resolve(
  process.cwd(),
  "../ingestion/data/lancedb",
);

export const config = {
  port: Number(process.env.PORT ?? 3000),

  geminiApiKey: process.env.GEMINI_API_KEY,

  dbPath:
    process.env.LANCEDB_PATH
      ? path.resolve(process.cwd(), process.env.LANCEDB_PATH)
      : DEFAULT_DB_PATH,

  tableName: process.env.LANCEDB_TABLE ?? "pdp_corpus",

  chatModel:
    process.env.GEMINI_CHAT_MODEL ??
    "gemini-3.1-flash-lite",

  chatMaxHistoryTurns: Number(
    process.env.CHAT_MAX_HISTORY_TURNS ?? 6,
  ),

  queryRewrite: process.env.QUERY_REWRITE !== "0",

  queryEmbeddingCacheSize: 500,
};
