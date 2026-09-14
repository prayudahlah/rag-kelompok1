import { createEmbedder } from "@rag/shared";

import { config } from "../config.js";
import { LruCache } from "./cache.js";

const cache = new LruCache<string, number[]>(
  config.queryEmbeddingCacheSize,
);

let embedder: ReturnType<typeof createEmbedder> | null =
  null;

function getEmbedder() {
  if (!embedder) {
    embedder = createEmbedder({
      taskType: "RETRIEVAL_QUERY",
      apiKey: config.geminiApiKey,
    });
  }

  return embedder;
}

export interface QueryEmbedResult {
  vector: number[];
  cached: boolean;
}

export async function embedQuery(
  query: string,
): Promise<QueryEmbedResult> {
  const key = query.trim().toLowerCase();

  const cached = cache.get(key);

  if (cached) {
    return { vector: cached, cached: true };
  }

  const [vector] = await getEmbedder().embed([query]);

  cache.set(key, vector);

  return { vector, cached: false };
}

export function queryCacheSize(): number {
  return cache.size;
}
