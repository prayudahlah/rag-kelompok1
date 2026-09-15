import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DB_PATH = path.resolve(
  process.cwd(),
  "../ingestion/data/lancedb",
);

// Bangunan client (Vite) selalu ada di <root repo>/client/dist, terlepas
// dari cwd. Dihitung dari lokasi modul ini (server/src atau server/dist).
const DEFAULT_CLIENT_DIST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/dist",
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

  clientDistPath: process.env.CLIENT_DIST_PATH
    ? path.resolve(process.cwd(), process.env.CLIENT_DIST_PATH)
    : DEFAULT_CLIENT_DIST_PATH,
};
