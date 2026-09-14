import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { config } from "../utils/config.js";
import { readSources } from "../utils/manifest.js";

import type { Chunk, Section } from "../utils/types.js";

const NORMALIZED_DIR = path.resolve(
  config.data.normalized,
);
const CHUNKS_DIR = path.resolve(config.data.chunks);

export interface DocumentMeta {
  document_id: string;
  document_title: string;
}

export interface ChunkResult {
  chunks: Chunk[];
  consumedLines: string[];
}

export interface ValidationReport {
  valid: boolean;
  totalChunks: number;
  duplicates: number;
  emptyText: number;
  invalidIds: number;
  missing: number;
  extra: number;
  missingSample: string[];
  extraSample: string[];
}

/* =========================================================
 * DETECTION HELPERS
 * ========================================================= */

function stripHeading(line: string): string {
  return line.replace(/^#{1,6}\s+/, "").trim();
}

function detectPage(line: string): number | null {
  const match = line.match(
    /^---\s*Halaman\s+(\d+)\s*---$/i,
  );

  return match ? Number.parseInt(match[1], 10) : null;
}

function detectBab(
  text: string,
): { bab: string; title: string | null } | null {
  const match = text.match(
    /^BAB\s+([IVXLCDM]+)\b\s*(.*)$/i,
  );

  if (!match) {
    return null;
  }

  const title = match[2]?.trim();

  return {
    bab: `BAB ${match[1].toUpperCase()}`,
    title: title && title.length > 0 ? title : null,
  };
}

function detectPasal(
  text: string,
): { pasal: string; pasal_number: number } | null {
  const match = text.match(/^Pasal\s+(\d+)\s*$/i);

  if (!match) {
    return null;
  }

  const pasalNumber = Number.parseInt(match[1], 10);

  return {
    pasal: `Pasal ${pasalNumber}`,
    pasal_number: pasalNumber,
  };
}

function detectBagian(text: string): string | null {
  const match = text.match(/^Bagian\s+(.+)$/i);

  return match ? `Bagian ${match[1].trim()}` : null;
}

function detectAyat(line: string): number | null {
  const match = line.match(/^\((\d+)\)\s+/);

  return match ? Number.parseInt(match[1], 10) : null;
}

function detectAngka(line: string): number | null {
  const match = line.match(/^(\d+)\.\s+/);

  return match ? Number.parseInt(match[1], 10) : null;
}

function isPengesahanStart(line: string): boolean {
  return (
    /Agar setiap orang mengetahuinya/i.test(line) ||
    /^Diundangkan di\b/i.test(line) ||
    /^Disahkan di\b/i.test(line)
  );
}

function isPenjelasanStart(line: string): boolean {
  return /^#*\s*PENJELASAN\b/i.test(line);
}

function isUmumHeading(stripped: string): boolean {
  return /^I\.\s*UMUM\b/i.test(stripped);
}

function isPasalDemiPasal(stripped: string): boolean {
  return /^II\.\s*PASAL DEMI PASAL\b/i.test(stripped);
}

function isTambahanLembaran(line: string): boolean {
  return /^TAMBAHAN LEMBARAN NEGARA\b/i.test(line);
}

/* =========================================================
 * CHUNKING
 * ========================================================= */

export function chunkText(
  normalized: string,
  doc: DocumentMeta,
): ChunkResult {
  const lines = normalized.split(/\r?\n/);
  const chunks: Chunk[] = [];
  const consumedLines: string[] = [];

  const docId = doc.document_id;

  let currentPage = 1;

  let section: Section = "pembukaan";

  let bab: string | null = null;
  let babTitle: string | null = null;
  let bagian: string | null = null;

  let pasal: string | null = null;
  let pasalNumber: number | null = null;

  let currentAyatNumber: number | null = null;
  let currentAngka: number | null = null;

  let currentText: string[] = [];
  let chunkPageStart: number | null = null;
  let chunkPageEnd: number | null = null;

  let batangTubuhStarted = false;
  let pengesahanStarted = false;
  let penjelasanMode = false;
  let umumMode = false;
  let umumStarted = false;
  let pasalDemiPasal = false;

  let umumIndex = 0;
  let pendingTitle: "bab" | "bagian" | null = null;

  const addText = (text: string, page: number): void => {
    const clean = text.trim();

    if (!clean) {
      return;
    }

    if (chunkPageStart === null) {
      chunkPageStart = page;
    }

    chunkPageEnd = page;
    currentText.push(clean);
  };

  const makeChunkId = (): string => {
    if (section === "pembukaan") {
      return `${docId}:pembukaan`;
    }

    if (section === "pengesahan") {
      return `${docId}:pengesahan`;
    }

    if (section === "penjelasan") {
      if (pasalNumber !== null) {
        return `${docId}:penjelasan:pasal-${pasalNumber}`;
      }

      return `${docId}:penjelasan:penutup`;
    }

    if (pasalNumber === null) {
      return `${docId}:batang-tubuh`;
    }

    if (
      currentAngka !== null &&
      pasalNumber === 1
    ) {
      return `${docId}:batang-tubuh:pasal-1:angka-${currentAngka}`;
    }

    if (currentAyatNumber !== null) {
      return `${docId}:batang-tubuh:pasal-${pasalNumber}:ayat-${currentAyatNumber}`;
    }

    return `${docId}:batang-tubuh:pasal-${pasalNumber}`;
  };

  const makeParentId = (): string | null => {
    if (section !== "batang_tubuh") {
      return null;
    }

    if (pasalNumber === null) {
      return null;
    }

    if (
      currentAyatNumber !== null ||
      currentAngka !== null
    ) {
      return `${docId}:batang-tubuh:pasal-${pasalNumber}`;
    }

    return null;
  };

  const flushChunk = (kind: "normal" | "umum"): void => {
    if (currentText.length === 0) {
      return;
    }

    const text = currentText.join("\n").trim();

    currentText = [];

    if (!text) {
      return;
    }

    const pageStart = chunkPageStart ?? currentPage;
    const pageEnd = chunkPageEnd ?? currentPage;

    let chunkId: string;
    let parentId: string | null;

    if (kind === "umum") {
      umumIndex += 1;
      chunkId = `${docId}:penjelasan:umum:${umumIndex}`;
      parentId = `${docId}:penjelasan:umum`;
    } else {
      chunkId = makeChunkId();
      parentId = makeParentId();
    }

    chunks.push({
      chunk_id: chunkId,
      document_id: docId,
      document_title: doc.document_title,
      section,
      bab,
      bab_title: babTitle,
      bagian,
      pasal,
      pasal_number: pasalNumber,
      ayat:
        currentAyatNumber !== null
          ? `(${currentAyatNumber})`
          : null,
      ayat_number: currentAyatNumber,
      angka: currentAngka,
      page_start: pageStart,
      page_end: pageEnd,
      text,
      parent_id: parentId,
    });

    chunkPageStart = null;
    chunkPageEnd = null;
  };

  const resetPasalState = (): void => {
    pasal = null;
    pasalNumber = null;
    currentAyatNumber = null;
    currentAngka = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "") {
      if (penjelasanMode && umumMode) {
        flushChunk("umum");
      }

      continue;
    }

    const detectedPage = detectPage(line);

    if (detectedPage !== null) {
      currentPage = detectedPage;
      consumedLines.push(line);
      continue;
    }

    const stripped = stripHeading(line);

    // ---- Penjelasan (transisi) ----
    if (!penjelasanMode && isPenjelasanStart(line)) {
      flushChunk("normal");
      section = "penjelasan";
      penjelasanMode = true;
      umumMode = false;
      umumStarted = false;
      pasalDemiPasal = false;
      bab = null;
      babTitle = null;
      bagian = null;
      resetPasalState();
      consumedLines.push(line);
      continue;
    }

    if (penjelasanMode) {
      if (isUmumHeading(stripped)) {
        flushChunk(umumMode ? "umum" : "normal");
        umumStarted = true;
        umumMode = true;
        pasalDemiPasal = false;
        resetPasalState();
        consumedLines.push(line);
        continue;
      }

      if (isPasalDemiPasal(stripped)) {
        flushChunk(umumMode ? "umum" : "normal");
        umumMode = false;
        pasalDemiPasal = true;
        resetPasalState();
        consumedLines.push(line);
        continue;
      }

      if (isTambahanLembaran(line)) {
        consumedLines.push(line);
        continue;
      }

      const pasalInfo = detectPasal(stripped);

      if (pasalInfo) {
        if (pasalInfo.pasal_number === pasalNumber) {
          consumedLines.push(line);
          continue;
        }

        flushChunk(umumMode ? "umum" : "normal");
        umumMode = false;
        pasal = pasalInfo.pasal;
        pasalNumber = pasalInfo.pasal_number;
        currentAyatNumber = null;
        currentAngka = null;
        pendingTitle = null;
        consumedLines.push(line);
        continue;
      }

      // Blok judul penjelasan sebelum I. UMUM / PASAL DEMI PASAL
      if (!umumStarted && !pasalDemiPasal) {
        consumedLines.push(line);
        continue;
      }

      if (umumMode) {
        addText(line, currentPage);
        continue;
      }

      addText(line, currentPage);
      continue;
    }

    // ---- Batang tubuh / pembukaan / pengesahan ----
    if (isTambahanLembaran(line)) {
      consumedLines.push(line);
      continue;
    }

    const babInfo = detectBab(stripped);

    if (babInfo) {
      flushChunk("normal");
      section = "batang_tubuh";
      batangTubuhStarted = true;
      bab = babInfo.bab;
      babTitle = babInfo.title;
      bagian = null;
      resetPasalState();
      pendingTitle =
        babInfo.title === null ? "bab" : null;
      consumedLines.push(line);
      continue;
    }

    const bagianInfo = detectBagian(stripped);

    if (bagianInfo) {
      flushChunk("normal");
      bagian = bagianInfo;
      resetPasalState();
      pendingTitle = "bagian";
      consumedLines.push(line);
      continue;
    }

    const pasalInfo = detectPasal(stripped);

    if (pasalInfo) {
      if (pasalInfo.pasal_number === pasalNumber) {
        consumedLines.push(line);
        continue;
      }

      flushChunk("normal");

      if (!batangTubuhStarted) {
        section = "batang_tubuh";
        batangTubuhStarted = true;
      }

      pasal = pasalInfo.pasal;
      pasalNumber = pasalInfo.pasal_number;
      currentAyatNumber = null;
      currentAngka = null;
      pendingTitle = null;
      consumedLines.push(line);
      continue;
    }

    // ---- Awal pengesahan ----
    if (
      batangTubuhStarted &&
      section !== "pengesahan" &&
      isPengesahanStart(line)
    ) {
      flushChunk("normal");
      section = "pengesahan";
      pengesahanStarted = true;
      resetPasalState();
      addText(line, currentPage);
      continue;
    }

    // ---- Judul BAB / Bagian pada baris berikutnya ----
    if (pendingTitle !== null) {
      if (pendingTitle === "bab") {
        babTitle = stripped;
      } else {
        bagian = bagian
          ? `${bagian}: ${stripped}`
          : stripped;
      }

      pendingTitle = null;
      consumedLines.push(line);
      continue;
    }

    // ---- Pasal 1: definisi per angka ----
    if (
      section === "batang_tubuh" &&
      pasalNumber === 1 &&
      currentAyatNumber === null
    ) {
      const angka = detectAngka(line);

      if (angka !== null) {
        if (angka === currentAngka) {
          addText(line, currentPage);
          continue;
        }

        flushChunk("normal");
        currentAngka = angka;
        addText(line, currentPage);
        continue;
      }
    }

    // ---- Ayat ----
    const ayatNumber = detectAyat(line);

    if (
      ayatNumber !== null &&
      section === "batang_tubuh"
    ) {
      if (ayatNumber === currentAyatNumber) {
        addText(line, currentPage);
        continue;
      }

      flushChunk("normal");
      currentAngka = null;
      currentAyatNumber = ayatNumber;
      addText(line, currentPage);
      continue;
    }

    addText(line, currentPage);
  }

  flushChunk(
    penjelasanMode && umumMode ? "umum" : "normal",
  );

  if (!pengesahanStarted) {
    console.warn(
      `  [warning] penanda pengesahan tidak ditemukan pada ${docId}`,
    );
  }

  return { chunks, consumedLines };
}

/* =========================================================
 * VALIDATION
 * ========================================================= */

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function countMap(
  lines: string[],
): Map<string, number> {
  const map = new Map<string, number>();

  for (const line of lines) {
    map.set(line, (map.get(line) ?? 0) + 1);
  }

  return map;
}

export function validateChunks(
  inputText: string,
  chunks: Chunk[],
  consumedLines: string[],
): ValidationReport {
  const input = inputText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const covered = [
    ...chunks.flatMap((chunk) =>
      chunk.text.split(/\r?\n/),
    ),
    ...consumedLines,
  ]
    .map(normalizeLine)
    .filter(Boolean);

  const inputCounts = countMap(input);
  const coveredCounts = countMap(covered);

  const missingSample: string[] = [];
  const extraSample: string[] = [];

  let missing = 0;
  let extra = 0;

  for (const [line, count] of inputCounts) {
    const got = coveredCounts.get(line) ?? 0;

    if (got < count) {
      missing += count - got;
      if (missingSample.length < 10) {
        missingSample.push(line);
      }
    }
  }

  for (const [line, count] of coveredCounts) {
    const want = inputCounts.get(line) ?? 0;

    if (want < count) {
      extra += count - want;
      if (extraSample.length < 10) {
        extraSample.push(line);
      }
    }
  }

  const ids = chunks.map((chunk) => chunk.chunk_id);

  const duplicates = ids.length - new Set(ids).size;

  const emptyText = chunks.filter(
    (chunk) => chunk.text.trim() === "",
  ).length;

  const invalidIds = ids.filter(
    (id) => !/^[^:\s]+(:[^:\s]+)+$/.test(id),
  ).length;

  return {
    valid:
      missing === 0 &&
      extra === 0 &&
      duplicates === 0 &&
      emptyText === 0 &&
      invalidIds === 0,
    totalChunks: chunks.length,
    duplicates,
    emptyText,
    invalidIds,
    missing,
    extra,
    missingSample,
    extraSample,
  };
}

/* =========================================================
 * RUNNER
 * ========================================================= */

function main(): void {
  const sources = readSources();

  const enabled = sources.documents.filter(
    (doc) => doc.enabled !== false,
  );

  fs.mkdirSync(CHUNKS_DIR, { recursive: true });

  console.log(
    `[chunk] ${enabled.length} dokumen aktif`,
  );

  let failures = 0;

  for (const doc of enabled) {
    const inputPath = path.join(
      NORMALIZED_DIR,
      `${doc.document_id}.normalized.md`,
    );

    if (!fs.existsSync(inputPath)) {
      console.error(
        `[${doc.document_id}] input tidak ditemukan: ${inputPath}\n` +
          '  → jalankan "npm run normalize" lebih dulu.',
      );

      failures++;
      continue;
    }

    const normalized = fs.readFileSync(
      inputPath,
      "utf-8",
    );

    const { chunks, consumedLines } = chunkText(
      normalized,
      {
        document_id: doc.document_id,
        document_title: doc.doc_title,
      },
    );

    const report = validateChunks(
      normalized,
      chunks,
      consumedLines,
    );

    const bySection: Record<string, number> = {};

    for (const chunk of chunks) {
      bySection[chunk.section] =
        (bySection[chunk.section] ?? 0) + 1;
    }

    console.log(
      `[${doc.document_id}] total=${chunks.length} sections=${JSON.stringify(bySection)}`,
    );

    console.log(
      `  duplicates=${report.duplicates} empty=${report.emptyText} invalidIds=${report.invalidIds} missing=${report.missing} extra=${report.extra}`,
    );

    if (!report.valid) {
      console.error("  VALIDASI GAGAL");

      for (const line of report.missingSample) {
        console.error(`  missing: ${line}`);
      }

      for (const line of report.extraSample) {
        console.error(`  extra: ${line}`);
      }

      failures++;
      continue;
    }

    const outputPath = path.join(
      CHUNKS_DIR,
      `${doc.document_id}.chunks.json`,
    );

    fs.writeFileSync(
      outputPath,
      JSON.stringify(chunks, null, 2),
      "utf-8",
    );

    console.log(`  → ${outputPath}`);
  }

  if (failures > 0) {
    console.error(`\nGagal: ${failures} dokumen.`);
    process.exit(1);
  }

  console.log("\nSTEP 4 (chunk) : PASS");
}

const entry = process.argv[1];

if (
  entry &&
  import.meta.url === pathToFileURL(entry).href
) {
  main();
}
