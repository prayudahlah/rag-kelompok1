import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }

  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const config = {
  geminiApiKey: optionalEnv("GEMINI_API_KEY"),

  data: {
    raw: "data/raw",
    extracted: "data/extracted",
    normalized: "data/normalized",
    chunks: "data/chunks",
    lancedb: "data/lancedb",
  },

  corpus: {
    dir: "corpus",
    sources: "corpus/sources.json",
    manifest: "corpus/manifest.json",
  },
};

/**
 * Kunci API sengaja diambil lewat fungsi (bukan dievaluasi saat import)
 * supaya tahap yang tidak butuh LlamaCloud (mis. fetch) tidak gagal
 * hanya karena env belum diatur.
 */
export function getLlamaCloudApiKey(): string {
  return requireEnv("LLAMA_CLOUD_API_KEY");
}

export function getGeminiApiKey(): string {
  return requireEnv("GEMINI_API_KEY");
}
