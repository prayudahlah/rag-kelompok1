import { GoogleGenAI } from "@google/genai";

import { config } from "../config.js";

let client: GoogleGenAI | null = null;

export function getGenAIClient(): GoogleGenAI {
  if (!client) {
    const apiKey = config.geminiApiKey;

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY belum diatur untuk generation.",
      );
    }

    client = new GoogleGenAI({ apiKey });
  }

  return client;
}

export function getResponseText(response: unknown): string {
  const value = response as {
    text?: unknown;
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: unknown }>;
      };
    }>;
  };

  if (typeof value.text === "string") {
    return value.text;
  }

  const parts =
    value.candidates?.[0]?.content?.parts ?? [];

  return parts
    .map((part) =>
      typeof part.text === "string" ? part.text : "",
    )
    .join("")
    .trim();
}
