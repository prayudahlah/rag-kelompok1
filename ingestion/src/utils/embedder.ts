import { GoogleGenAI } from "@google/genai";

export const MODEL = "gemini-embedding-001";
export const DIMENSION = 768;

export function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(
    vec.reduce((sum, value) => sum + value * value, 0),
  );

  if (norm === 0) {
    return vec;
  }

  return vec.map((value) => value / norm);
}

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

function getStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown })?.status;

  return typeof status === "number" ? status : undefined;
}

function getRetryDelayMs(err: unknown): number | undefined {
  const retryInfo = (
    err as {
      error?: {
        details?: Array<{
          "@type"?: string;
          retryDelay?: string;
        }>;
      };
    }
  )?.error?.details;

  if (!Array.isArray(retryInfo)) {
    return undefined;
  }

  const detail = retryInfo.find(
    (item) =>
      item["@type"] ===
      "type.googleapis.com/google.rpc.RetryInfo",
  );

  const retryDelay = detail?.retryDelay;

  if (!retryDelay) {
    return undefined;
  }

  const match = retryDelay.match(/^(\d+(?:\.\d+)?)s$/);

  if (!match) {
    return undefined;
  }

  return Math.ceil(Number(match[1]) * 1000);
}

function isTransient(err: unknown): boolean {
  const status = getStatus(err);

  if (status === 401 || status === 403) {
    return false;
  }

  if (status === 429) {
    return true;
  }

  if (typeof status === "number") {
    return status >= 500;
  }

  return false;
}

export function createEmbedder(): Embedder {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur di .env");
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  async function embedBatch(
    texts: string[],
  ): Promise<number[][]> {
    const result = await ai.models.embedContent({
      model: MODEL,
      contents: texts,
      config: {
        outputDimensionality: DIMENSION,
      },
    });

    const embeddings = result.embeddings ?? [];

    if (embeddings.length !== texts.length) {
      throw new Error(
        `Jumlah embedding (${embeddings.length}) != jumlah input (${texts.length})`,
      );
    }

    return embeddings.map((embedding, index) => {
      const values = embedding.values;

      if (!values || values.length !== DIMENSION) {
        throw new Error(
          `Embedding #${index} dimensi invalid: ${
            values?.length ?? 0
          } (expected ${DIMENSION})`,
        );
      }

      for (const value of values) {
        if (
          typeof value !== "number" ||
          !Number.isFinite(value)
        ) {
          throw new Error(
            `Embedding #${index} mengandung nilai non-number/NaN/Infinity`,
          );
        }
      }

      return l2Normalize(values);
    });
  }

  async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 5,
  ): Promise<T> {
    let lastError: unknown;

    for (
      let attempt = 0;
      attempt <= retries;
      attempt++
    ) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (
          !isTransient(error) ||
          attempt === retries
        ) {
          break;
        }

        const status = getStatus(error);

        let waitMs: number;

        if (status === 429) {
          const serverDelay = getRetryDelayMs(error);

          waitMs =
            serverDelay !== undefined
              ? serverDelay + 1000
              : Math.min(
                  60000,
                  1000 * 2 ** attempt,
                );
        } else {
          waitMs = Math.min(
            60000,
            1000 * 2 ** attempt,
          );
        }

        console.warn(
          `  retry ${attempt + 1}/${retries} dalam ${waitMs}ms ...`,
        );

        await new Promise((resolve) =>
          setTimeout(resolve, waitMs),
        );
      }
    }

    throw lastError;
  }

  return {
    embed(texts: string[]): Promise<number[][]> {
      return withRetry(() => embedBatch(texts));
    },
  };
}       