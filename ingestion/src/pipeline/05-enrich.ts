import fs from "node:fs";
import path from "node:path";

import { config } from "../utils/config.js";
import { readSources } from "../utils/manifest.js";

import type { Chunk } from "../utils/types.js";

const CHUNKS_DIR = path.resolve(config.data.chunks);

interface EnrichedChunk extends Chunk {
  source: string;
  document_type: string;
  doc_number: number;
  doc_year: number;
  corpus_version: string;
  content_type: string;
  context_header: string;
}

/**
 * Membentuk header konteks yang akan disisipkan sebelum `text`
 * saat embedding, mis.
 * "UU 27/2022 | BAB V PEMROSESAN DATA PRIBADI | Pasal 16 ayat (2)".
 */
function buildContextHeader(
  chunk: Chunk,
  docType: string,
  docNumber: number,
  docYear: number,
): string {
  const parts: string[] = [
    `${docType} ${docNumber}/${docYear}`,
  ];

  if (chunk.section === "pembukaan") {
    parts.push("Pembukaan");
  } else if (chunk.section === "pengesahan") {
    parts.push("Pengesahan");
  } else if (chunk.section === "penjelasan") {
    if (chunk.pasal) {
      parts.push(`Penjelasan ${chunk.pasal}`);
    } else {
      parts.push("Penjelasan Umum");
    }
  } else {
    if (chunk.bab) {
      parts.push(
        chunk.bab_title
          ? `${chunk.bab} ${chunk.bab_title}`
          : chunk.bab,
      );
    }

    if (chunk.bagian) {
      parts.push(chunk.bagian);
    }

    if (chunk.pasal) {
      if (chunk.ayat) {
        parts.push(`${chunk.pasal} ayat ${chunk.ayat}`);
      } else if (chunk.angka !== null) {
        parts.push(`${chunk.pasal} angka ${chunk.angka}`);
      } else {
        parts.push(chunk.pasal);
      }
    }
  }

  return parts.join(" | ");
}

const HIERARCHY_KEYS = [
  "section",
  "bab",
  "bab_title",
  "bagian",
  "pasal",
  "pasal_number",
  "ayat",
  "ayat_number",
  "angka",
] as const;

function main(): void {
  const sources = readSources();

  const enabled = sources.documents.filter(
    (doc) => doc.enabled !== false,
  );

  fs.mkdirSync(CHUNKS_DIR, { recursive: true });

  console.log(
    `[enrich] ${enabled.length} dokumen aktif`,
  );

  let failures = 0;

  for (const doc of enabled) {
    const inputPath = path.join(
      CHUNKS_DIR,
      `${doc.document_id}.chunks.json`,
    );

    const outputPath = path.join(
      CHUNKS_DIR,
      `${doc.document_id}.enriched.json`,
    );

    if (!fs.existsSync(inputPath)) {
      console.error(
        `[${doc.document_id}] input tidak ditemukan: ${inputPath}\n` +
          '  → jalankan "npm run chunk" lebih dulu.',
      );

      failures++;
      continue;
    }

    const before = JSON.parse(
      fs.readFileSync(inputPath, "utf-8"),
    ) as Chunk[];

    const after: EnrichedChunk[] = before.map(
      (chunk) => ({
        ...chunk,
        source: doc.source,
        document_type: doc.doc_type,
        doc_number: doc.doc_number,
        doc_year: doc.doc_year,
        corpus_version: sources.corpus_version,
        content_type: chunk.section,
        context_header: buildContextHeader(
          chunk,
          doc.doc_type,
          doc.doc_number,
          doc.doc_year,
        ),
      }),
    );

    const report = validate(before, after);

    console.log(
      `[${doc.document_id}] chunks=${after.length} identityDiff=${report.identityDiff} metadataInconsistent=${report.metadataInconsistent} duplicates=${report.duplicates}`,
    );

    if (!report.valid) {
      console.error("  VALIDASI GAGAL");
      failures++;
      continue;
    }

    fs.writeFileSync(
      outputPath,
      JSON.stringify(after, null, 2),
      "utf-8",
    );

    console.log(`  → ${outputPath}`);
  }

  if (failures > 0) {
    console.error(`\nGagal: ${failures} dokumen.`);
    process.exit(1);
  }

  console.log("\nSTEP 5 (enrich) : PASS");
}

function validate(
  before: Chunk[],
  after: EnrichedChunk[],
): {
  valid: boolean;
  identityDiff: number;
  metadataInconsistent: number;
  duplicates: number;
} {
  let identityDiff = 0;

  const count = Math.min(before.length, after.length);

  for (let i = 0; i < count; i++) {
    const a = before[i];
    const b = after[i];

    if (b.chunk_id !== a.chunk_id) identityDiff++;
    if (b.text !== a.text) identityDiff++;

    for (const key of HIERARCHY_KEYS) {
      if (b[key] !== a[key]) identityDiff++;
    }

    if (
      b.page_start !== a.page_start ||
      b.page_end !== a.page_end
    ) {
      identityDiff++;
    }

    if (b.parent_id !== a.parent_id) identityDiff++;
  }

  if (before.length !== after.length) {
    identityDiff++;
  }

  let metadataInconsistent = 0;

  for (const chunk of after) {
    if (chunk.content_type !== chunk.section) {
      metadataInconsistent++;
    }

    if (
      typeof chunk.source !== "string" ||
      chunk.source.length === 0
    ) {
      metadataInconsistent++;
    }

    if (
      typeof chunk.document_type !== "string" ||
      chunk.document_type.length === 0
    ) {
      metadataInconsistent++;
    }

    if (
      typeof chunk.corpus_version !== "string" ||
      chunk.corpus_version.length === 0
    ) {
      metadataInconsistent++;
    }

    if (
      typeof chunk.context_header !== "string" ||
      chunk.context_header.length === 0
    ) {
      metadataInconsistent++;
    }
  }

  const ids = after.map((chunk) => chunk.chunk_id);

  const duplicates = ids.length - new Set(ids).size;

  return {
    valid:
      identityDiff === 0 &&
      metadataInconsistent === 0 &&
      duplicates === 0,
    identityDiff,
    metadataInconsistent,
    duplicates,
  };
}

main();
