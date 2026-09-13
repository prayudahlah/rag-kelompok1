import fs from "fs";
import path from "path";
import type { Chunk } from "./types.js";

const INPUT_PATH = path.resolve("data/chunks/uu27-2022.chunks.json");
const OUTPUT_PATH = path.resolve("data/chunks/uu27-2022.enriched.json");

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
    console.error(`Input tidak ditemukan: ${INPUT_PATH}`);
    process.exit(1);
  }

  const before = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8")) as Chunk[];

  const after: EnrichedChunk[] = before.map((c) => ({
    ...c,
    source: SOURCE,
    document_type: DOCUMENT_TYPE,
    corpus_version: CORPUS_VERSION,
    content_type: c.section,
  }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(after, null, 2), "utf-8");

  // ---- Validation (deterministic before/after) ----
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
  const pageKeys = ["page_start", "page_end"] as const;

  const idOrderOk = before.every((c, i) => after[i]?.chunk_id === c.chunk_id);

  let idDiff = 0;
  let textDiff = 0;
  let hierDiff = 0;
  let pageDiff = 0;
  const n = Math.min(before.length, after.length);
  for (let i = 0; i < n; i++) {
    const b = before[i];
    const a = after[i];
    if (a.chunk_id !== b.chunk_id) idDiff++;
    if (a.text !== b.text) textDiff++;
    for (const k of hierarchyKeys) if (a[k] !== b[k]) hierDiff++;
    for (const k of pageKeys) if (a[k] !== b[k]) pageDiff++;
  }

  const ids = after.map((c) => c.chunk_id);
  const dupIds = ids.length - new Set(ids).size;

  let metaInconsistency = 0;
  for (const c of after) {
    if (c.source !== SOURCE) metaInconsistency++;
    if (c.document_type !== DOCUMENT_TYPE) metaInconsistency++;
    if (c.corpus_version !== CORPUS_VERSION) metaInconsistency++;
    if (c.content_type !== c.section) metaInconsistency++;
  }

  const allPass =
    before.length === after.length &&
    idOrderOk &&
    idDiff === 0 &&
    dupIds === 0 &&
    textDiff === 0 &&
    hierDiff === 0 &&
    pageDiff === 0 &&
    metaInconsistency === 0;

  console.log(`Input  : ${INPUT_PATH}`);
  console.log(`Output : ${OUTPUT_PATH}`);
  console.log("");
  console.log(`Jumlah chunk (before/after): ${before.length} / ${after.length}`);
  console.log(`chunk_id urut & sama      : ${idOrderOk && idDiff === 0 ? "PASS" : "FAIL"}`);
  console.log(`chunk_id duplikat         : ${dupIds}`);
  console.log(`text identik (diff)       : ${textDiff}`);
  console.log(`hierarchy field diff      : ${hierDiff}`);
  console.log(`page provenance diff      : ${pageDiff}`);
  console.log(`metadata baru konsisten   : ${metaInconsistency === 0 ? "PASS" : "FAIL"}`);
  console.log("");
  console.log(`Field baru: source="${SOURCE}", document_type="${DOCUMENT_TYPE}", corpus_version="${CORPUS_VERSION}", content_type=<section>`);
  console.log(`Validasi akhir            : ${allPass ? "ALL PASS" : "FAIL"}`);

  if (!allPass) process.exit(1);
}

main();
