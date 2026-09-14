import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";
import type { SourceChunk } from "./types.js";

const GENERATION_MODEL = "gemini-3.6-flash";

export async function generate(
  question: string,
  context: SourceChunk[],
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  const contextStr = context
    .map(
      (c, i) =>
        `[${i + 1}] ${c.pasal}${c.ayat ? " Ayat " + c.ayat : ""} (hal. ${c.page_start}): ${c.text}`,
    )
    .join("\n\n");

  const prompt = `Kamu adalah asisten hukum Indonesia yang menjawab pertanyaan tentang Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.

ATURAN:
- Jawab HANYA berdasarkan konteks yang diberikan
- Jika jawaban tidak ada di konteks, katakan "Saya tidak menemukan jawaban di UU PDP"
- Sertakan referensi Pasal/Ayat saat menjawab
- Gunakan bahasa Indonesia yang jelas dan mudah dipahami
- Jawab dengan bahasa natural, seolah-olah kamu sedang menjelaskan kepada seseorang yang bukan ahli hukum
- Gunakan analogi sederhana jika diperlukan untuk menjelaskan konsep hukum
- Hindari bahasa kaku atau terlalu formal yang sulit dipahami
- Struktur jawaban dengan poin-poin atau paragraf yang rapi agar mudah dibaca

KONTEKS:
${contextStr}

PERTANYAAN: ${question}

JAWABAN:`;

  const result = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt,
  });

  return result.text ?? "Maaf, terjadi kesalahan saat menghasilkan jawaban.";
}
