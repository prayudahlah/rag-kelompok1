import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }

  return value;
}

export const config = {
  pasalToken: requireEnv("PASAL_MCP_TOKEN"),
  geminiApiKey: requireEnv("GEMINI_API_KEY"),

  pasalApiUrl: "https://pasal.id/api/v1",

  data: {
    raw: "data/raw",
    normalized: "data/normalized",
    chunks: "data/chunks",
    lancedb: "data/lancedb"
  }
};