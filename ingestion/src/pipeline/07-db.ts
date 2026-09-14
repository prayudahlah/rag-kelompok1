import fs from "node:fs/promises";
import path from "node:path";

import * as lancedb from "@lancedb/lancedb";

import { config } from "../utils/config.js";
import {
  loadManifest,
  readSources,
  saveManifest,
} from "../utils/manifest.js";
import { DIMENSION, MODEL } from "../utils/embedder.js";

import type { ManifestEntry } from "../utils/types.js";

const DB_PATH = path.resolve(config.data.lancedb);
const CHUNKS_DIR = path.resolve(config.data.chunks);

const TABLE_NAME = "pdp_corpus";

interface EmbeddedChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;

  section: string;
  bab: string | null;
  bab_title: string | null;
  bagian: string | null;
  pasal: string | null;
  pasal_number: number | null;
  ayat: string | null;
  ayat_number: number | null;
  angka: number | null;

  page_start: number;
  page_end: number;
  text: string;
  parent_id: string | null;
  context_header: string | null;

  source: string;
  document_type: string;
  doc_number: number;
  doc_year: number;
  corpus_version: string;
  content_type: string;

  embedding: number[];
  embedding_model: string;
  embedding_dimension: number;
}

interface LanceRow {
  vector: number[];

  chunk_id: string;
  document_id: string;
  document_title: string;

  section: string;
  bab: string | null;
  bab_title: string | null;
  bagian: string | null;
  pasal: string | null;
  pasal_number: number | null;
  ayat: string | null;
  ayat_number: number | null;
  angka: number | null;

  page_start: number;
  page_end: number;
  text: string;
  parent_id: string | null;
  context_header: string | null;

  source: string;
  document_type: string;
  doc_number: number;
  doc_year: number;
  corpus_version: string;
  content_type: string;

  embedding_model: string;
  embedding_dimension: number;
}

function getVectorLength(vector: unknown): number {
  if (vector === null || vector === undefined) {
    return 0;
  }

  const candidate = vector as { length?: unknown };

  return typeof candidate.length === "number"
    ? candidate.length
    : 0;
}

function toRow(chunk: EmbeddedChunk): LanceRow {
  if (!chunk.text || chunk.text.trim() === "") {
    throw new Error(
      `Chunk ${chunk.chunk_id} memiliki text kosong.`,
    );
  }

  if (!Array.isArray(chunk.embedding)) {
    throw new Error(
      `Chunk ${chunk.chunk_id} tidak memiliki embedding array.`,
    );
  }

  if (chunk.embedding.length !== DIMENSION) {
    throw new Error(
      `Dimensi embedding salah pada ${chunk.chunk_id}: ${chunk.embedding.length}`,
    );
  }

  if (chunk.embedding_model !== MODEL) {
    throw new Error(
      `Model embedding tidak sesuai pada ${chunk.chunk_id}: ${chunk.embedding_model}`,
    );
  }

  for (const value of chunk.embedding) {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Embedding ${chunk.chunk_id} mengandung nilai non-finite.`,
      );
    }
  }

  return {
    vector: chunk.embedding,

    chunk_id: chunk.chunk_id,
    document_id: chunk.document_id,
    document_title: chunk.document_title,

    section: chunk.section,
    bab: chunk.bab,
    bab_title: chunk.bab_title,
    bagian: chunk.bagian,
    pasal: chunk.pasal,
    pasal_number: chunk.pasal_number,
    ayat: chunk.ayat,
    ayat_number: chunk.ayat_number,
    angka: chunk.angka,

    page_start: chunk.page_start,
    page_end: chunk.page_end,
    text: chunk.text,
    parent_id: chunk.parent_id ?? null,
    context_header: chunk.context_header ?? null,

    source: chunk.source,
    document_type: chunk.document_type,
    doc_number: chunk.doc_number,
    doc_year: chunk.doc_year,
    corpus_version: chunk.corpus_version,
    content_type: chunk.content_type,

    embedding_model: chunk.embedding_model,
    embedding_dimension: chunk.embedding_dimension,
  };
}

function baseEntry(docId: string): ManifestEntry {
  return {
    document_id: docId,
    source_url: "",
    status: "missing",
    retrieved_at: null,
    bytes: null,
    sha256: null,
  };
}

async function main(): Promise<void> {
  const sources = readSources();
  const manifest = loadManifest(sources.corpus_version);

  const enabled = sources.documents.filter(
    (doc) => doc.enabled !== false,
  );

  console.log(
    `[db] ${enabled.length} dokumen aktif → table "${TABLE_NAME}"`,
  );

  const rows: LanceRow[] = [];
  const seenIds = new Set<string>();
  const rowsByDoc: Record<string, number> = {};

  for (const doc of enabled) {
    const inputPath = path.join(
      CHUNKS_DIR,
      `${doc.document_id}.embedded.json`,
    );

    try {
      await fs.access(inputPath);
    } catch {
      throw new Error(
        `[${doc.document_id}] input tidak ditemukan: ${inputPath}\n` +
          '  → jalankan "npm run embed" lebih dulu.',
      );
    }

    const chunks = JSON.parse(
      await fs.readFile(inputPath, "utf-8"),
    ) as EmbeddedChunk[];

    for (const chunk of chunks) {
      if (seenIds.has(chunk.chunk_id)) {
        throw new Error(
          `chunk_id duplikat: ${chunk.chunk_id}`,
        );
      }

      seenIds.add(chunk.chunk_id);
      rows.push(toRow(chunk));
    }

    rowsByDoc[doc.document_id] = chunks.length;

    console.log(
      `  [${doc.document_id}] ${chunks.length} row`,
    );
  }

  if (rows.length === 0) {
    throw new Error("Tidak ada row untuk dimasukkan.");
  }

  await fs.mkdir(DB_PATH, { recursive: true });

  const db = await lancedb.connect(DB_PATH);

  const existing = await db.tableNames();

  if (existing.includes(TABLE_NAME)) {
    console.log(`  menghapus table lama "${TABLE_NAME}"...`);
    await db.dropTable(TABLE_NAME);
  }

  const table = await db.createTable(
    TABLE_NAME,
    rows as unknown as Record<string, unknown>[],
  );

  console.log("  membuat FTS index pada kolom text...");
  await table.createIndex("text", {
    config: lancedb.Index.fts(),
  });

  const count = await table.countRows();

  if (count !== rows.length) {
    throw new Error(
      `Jumlah row tidak sesuai. Expected ${rows.length}, actual ${count}.`,
    );
  }

  const sampleRows = await table.query().limit(1).toArray();
  const vectorLength = getVectorLength(
    sampleRows[0]?.vector,
  );

  if (vectorLength !== DIMENSION) {
    throw new Error(
      `Dimensi vector di LanceDB salah: ${vectorLength} (expected ${DIMENSION})`,
    );
  }

  const indices = await table.listIndices();

  console.log(
    `  row=${count}, dimensi=${vectorLength}, table=${TABLE_NAME}`,
  );
  console.log(
    `  indices: ${indices.map((i) => i.name).join(", ")}`,
  );

  const now = new Date().toISOString();

  for (const doc of enabled) {
    const entry =
      manifest.documents[doc.document_id] ??
      baseEntry(doc.document_id);

    manifest.documents[doc.document_id] = {
      ...entry,
      db_built_at: now,
      db_rows: rowsByDoc[doc.document_id] ?? null,
    };
  }

  manifest.generated_at = now;
  saveManifest(manifest);

  console.log(`  database: ${DB_PATH}`);
  console.log("\nSTEP 7 (db) : PASS");
}

main().catch((error) => {
  console.error("Gagal:", error);
  process.exit(1);
});
