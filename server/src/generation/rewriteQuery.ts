import { config } from "../config.js";

import {
  getGenAIClient,
  getResponseText,
} from "./gemini.js";

import type { ChatMessage } from "./prompt.js";

const REWRITE_INSTRUCTION = [
  "Anda mengubah pertanyaan lanjutan menjadi query pencarian mandiri berbahasa Indonesia.",
  "Gunakan riwayat percakapan untuk mengganti kata ganti atau rujukan (mis. 'itu', 'sanksi tersebut', 'beliau').",
  "Pertahankan istilah hukum dan nomor pasal bila ada.",
  "Keluarkan HANYA query hasil penulisan ulang: tanpa penjelasan, tanpa tanda kutip, satu baris.",
].join("\n");

/**
 * Mengubah pertanyaan terakhir menjadi query pencarian mandiri
 * dengan memanfaatkan riwayat percakapan. Mengembalikan null bila
 * tidak ada riwayat (rewrite tidak perlu) atau bila hasil kosong.
 */
export async function rewriteQuery(
  messages: ChatMessage[],
): Promise<string | null> {
  let lastUserIndex = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }

  if (lastUserIndex <= 0) {
    return null;
  }

  const history = messages
    .slice(0, lastUserIndex)
    .slice(-config.chatMaxHistoryTurns);

  const historyBlock = history
    .map(
      (message) =>
        `${message.role === "user" ? "User" : "Asisten"}: ${message.content}`,
    )
    .join("\n");

  const prompt = [
    "RIWAYAT:",
    historyBlock,
    "",
    "PERTANYAAN TERAKHIR:",
    messages[lastUserIndex].content,
  ].join("\n");

  const response = await getGenAIClient().models.generateContent(
    {
      model: config.chatModel,
      contents: prompt,
      config: {
        systemInstruction: REWRITE_INSTRUCTION,
        temperature: 0,
      },
    },
  );

  const rewritten = getResponseText(response)
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .split(/\r?\n/)[0]
    .trim();

  return rewritten.length > 0 ? rewritten : null;
}
