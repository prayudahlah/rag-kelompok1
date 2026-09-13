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
  llamaCloudApiKey: requireEnv("LLAMA_CLOUD_API_KEY"),

  geminiApiKey: optionalEnv("GEMINI_API_KEY"),

  data: {
    raw: "data/raw",
    extracted: "data/extracted",
    normalized: "data/normalized",
    chunks: "data/chunks",
    lancedb: "data/lancedb",
  },
};