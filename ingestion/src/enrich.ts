import fs from "fs";
import path from "path";

import type { Chunk } from "./types.js";

const INPUT_PATH = path.resolve(
  "data/chunks/uu27-2022.chunks.json",
);

const OUTPUT_PATH = path.resolve(
  "data/chunks/uu27-2022.enriched.json",
);

const SOURCE = "JDIHN";
const DOCUMENT_TYPE = "undang-undang";
const CORPUS_VERSION = "uu-27-2022";

interface EnrichedChunk extends Chunk {
  source: string;
  document_type: string;
  corpus_version: string;
  content_type: Chunk["section"];
}

function main(): void {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(
      `Input tidak ditemukan: ${INPUT_PATH}`,
    );
    process.exit(1);
  }

  const before = JSON.parse(
    fs.readFileSync(INPUT_PATH, "utf-8"),
  ) as Chunk[];

  const after: EnrichedChunk[] = before.map((chunk) => ({
    ...chunk,
    source: SOURCE,
    document_type: DOCUMENT_TYPE,
    corpus_version: CORPUS_VERSION,
    content_type: chunk.section,
  }));

  // ---- Validation ----

  const hierarchyKeys = [
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

  const pageKeys = [
    "page_start",
    "page_end",
  ] as const;

  const idOrderOk = before.every(
    (chunk, index) =>
      after[index]?.chunk_id === chunk.chunk_id,
  );

  let idDiff = 0;
  let textDiff = 0;
  let hierarchyDiff = 0;
  let pageDiff = 0;

  const count = Math.min(
    before.length,
    after.length,
  );

  for (let i = 0; i < count; i++) {
    const beforeChunk = before[i];
    const afterChunk = after[i];

    if (
      afterChunk.chunk_id !==
      beforeChunk.chunk_id
    ) {
      idDiff++;
    }

    if (
      afterChunk.text !== beforeChunk.text
    ) {
      textDiff++;
    }

    for (const key of hierarchyKeys) {
      if (afterChunk[key] !== beforeChunk[key]) {
        hierarchyDiff++;
      }
    }

    for (const key of pageKeys) {
      if (afterChunk[key] !== beforeChunk[key]) {
        pageDiff++;
      }
    }
  }

  const ids = after.map(
    (chunk) => chunk.chunk_id,
  );

  const duplicateIds =
    ids.length - new Set(ids).size;

  let metadataInconsistency = 0;

  for (const chunk of after) {
    if (chunk.source !== SOURCE) {
      metadataInconsistency++;
    }

    if (
      chunk.document_type !== DOCUMENT_TYPE
    ) {
      metadataInconsistency++;
    }

    if (
      chunk.corpus_version !== CORPUS_VERSION
    ) {
      metadataInconsistency++;
    }

    if (
      chunk.content_type !== chunk.section
    ) {
      metadataInconsistency++;
    }
  }

  const allPass =
    before.length === after.length &&
    idOrderOk &&
    idDiff === 0 &&
    duplicateIds === 0 &&
    textDiff === 0 &&
    hierarchyDiff === 0 &&
    pageDiff === 0 &&
    metadataInconsistency === 0;

  console.log(
    `Input  : ${INPUT_PATH}`,
  );

  console.log(
    `Output : ${OUTPUT_PATH}`,
  );

  console.log("");

  console.log(
    `Jumlah chunk (before/after): ${before.length} / ${after.length}`,
  );

  console.log(
    `chunk_id urut & sama      : ${
      idOrderOk && idDiff === 0
        ? "PASS"
        : "FAIL"
    }`,
  );

  console.log(
    `chunk_id duplikat         : ${duplicateIds}`,
  );

  console.log(
    `text identik (diff)       : ${textDiff}`,
  );

  console.log(
    `hierarchy field diff      : ${hierarchyDiff}`,
  );

  console.log(
    `page provenance diff      : ${pageDiff}`,
  );

  console.log(
    `metadata baru konsisten   : ${
      metadataInconsistency === 0
        ? "PASS"
        : "FAIL"
    }`,
  );

  console.log("");

  console.log(
    `Field baru: source="${SOURCE}", document_type="${DOCUMENT_TYPE}", corpus_version="${CORPUS_VERSION}", content_type=<section>`,
  );

  console.log(
    `Validasi akhir            : ${
      allPass ? "ALL PASS" : "FAIL"
    }`,
  );

  if (!allPass) {
    process.exit(1);
  }

  // ---- Write output only after validation passes ----

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(after, null, 2),
    "utf-8",
  );

  console.log(
    `Enriched dataset disimpan: ${OUTPUT_PATH}`,
  );

  console.log("STEP 8 : PASS");
}

main();