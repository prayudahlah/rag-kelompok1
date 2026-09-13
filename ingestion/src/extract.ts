// PDF → text/markdown
import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }

  return value;
}

export const config = {
  llamaCloudApiKey: requireEnv("LLAMA_CLOUD_API_KEY"),

  data: {
    raw: "data/raw",
    extracted: "data/extracted",
    normalized: "data/normalized",
    chunks: "data/chunks",
    lancedb: "data/lancedb",
  },
};