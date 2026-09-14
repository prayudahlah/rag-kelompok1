import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }
  return value;
}

export const config = {
  geminiApiKey: requireEnv("GEMINI_API_KEY"),

  lancedbPath:
    process.env.LANCEDB_PATH ||
    path.resolve(__dirname, "../../ingestion/data/lancedb"),

  port: parseInt(process.env.PORT || "3001", 10),
};
