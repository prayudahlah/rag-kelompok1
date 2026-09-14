import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";

const REWRITE_MODEL = "gemini-3.6-flash";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const REWRITE_SYSTEM_PROMPT = `Kamu adalah asisten yang merangkum pertanyaan pengguna.

Berdasarkan riwayat percakapan dan pertanyaan terbaru, buatlah satu pertanyaan standalone yang lengkap dan jelas. Pertanyaan harus bisa dipahami tanpa konteks percakapan sebelumnya.

ATURAN:
- Rangkum menjadi satu pertanyaan yang jelas dan spesifik
- Sertakan konteks penting dari riwayat percakapan
- Jangan menambahkan informasi yang tidak ada dalam riwayat
- Gunakan bahasa Indonesia yang baik

CONTOH:
RIWAYAT:
User: Apa itu Data Pribadi?
Asisten: Data Pribadi adalah data yang berkaitan dengan seseorang yang teridentifikasi.
User: Siapa yang bertanggung jawab?

PERTANYAAN STANDALONE: Siapa yang bertanggung jawab melindungi Data Pribadi menurut UU Pelindungan Data Pribadi?`;

export async function rewriteQuery(
  history: HistoryMessage[],
  currentQuestion: string,
): Promise<string> {
  if (!history || history.length === 0) {
    return currentQuestion;
  }

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  const historyStr = history
    .map((msg) => `${msg.role === "user" ? "User" : "Asisten"}: ${msg.content}`)
    .join("\n");

  const rewritePrompt = `${REWRITE_SYSTEM_PROMPT}

RIWAYAT:
${historyStr}

PERTANYAAN TERBARU: ${currentQuestion}

PERTANYAAN STANDALONE:`;

  const result = await ai.models.generateContent({
    model: REWRITE_MODEL,
    contents: rewritePrompt,
  });

  const rewritten = result.text?.trim();

  if (!rewritten || rewritten.length === 0) {
    return currentQuestion;
  }

  return rewritten;
}
