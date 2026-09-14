import type { RetrievedChunk } from "@rag/shared";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const SYSTEM_INSTRUCTION = [
  "Anda adalah asisten hukum untuk Pelindungan Data Pribadi di Indonesia",
  "(UU Nomor 27 Tahun 2022 dan PP Nomor 71 Tahun 2019).",
  "",
  "Aturan:",
  "1. Jawab HANYA berdasarkan SUMBER yang diberikan. Jangan menambahkan fakta di luar sumber.",
  "2. Sertakan sitasi inline dengan format [S1], [S2], ... persis sesuai nomor sumber yang dipakai.",
  "3. Jika jawaban tidak ada di SUMBER, katakan dengan jujur bahwa dasarnya tidak ditemukan, dan sebutkan topik terdekat yang tersedia.",
  "4. Struktur jawaban: (a) ringkasan bahasa awam 2-4 kalimat lebih dulu, lalu (b) poin-poin untuk praktisi dengan penyebutan pasal/ayat.",
  "5. Gunakan Bahasa Indonesia yang jelas dan ringkas.",
  "6. Jawaban ini bukan nasihat hukum.",
].join("\n");

function sourceLabel(source: RetrievedChunk): string {
  if (source.context_header) {
    return source.context_header;
  }

  const numbered = source.pasal
    ? ` ${source.pasal}`
    : "";

  return `${source.document_title}${numbered}`.trim();
}

export function buildPrompt(
  messages: ChatMessage[],
  sources: RetrievedChunk[],
  maxHistoryTurns: number,
): string {
  let lastUserIndex = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }

  const question =
    lastUserIndex >= 0
      ? messages[lastUserIndex].content
      : "";

  const history = messages
    .slice(0, Math.max(0, lastUserIndex))
    .slice(-maxHistoryTurns);

  const historyBlock =
    history.length > 0
      ? history
          .map(
            (m) =>
              `${m.role === "user" ? "User" : "Asisten"}: ${m.content}`,
          )
          .join("\n")
      : "(tidak ada)";

  const sourcesBlock = sources
    .map((source, index) => {
      const label = sourceLabel(source);

      return `[S${index + 1}] ${label} (hlm. ${source.page_start}-${source.page_end})\n${source.text}`;
    })
    .join("\n\n");

  return [
    "RIWAYAT PERCAKAPAN:",
    historyBlock,
    "",
    "SUMBER:",
    sourcesBlock,
    "",
    "PERTANYAAN:",
    question,
  ].join("\n");
}
