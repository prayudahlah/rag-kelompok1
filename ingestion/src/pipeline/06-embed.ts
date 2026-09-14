import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { config } from "../utils/config.js";
import {
  loadManifest,
  readSources,
  saveManifest,
  sha256File,
} from "../utils/manifest.js";
import {
  createEmbedder,
  DIMENSION,
  MODEL,
} from "../utils/embedder.js";

import type { Chunk, ManifestEntry } from "../utils/types.js";

const CHUNKS_DIR = path.resolve(config.data.chunks);

const BATCH_SIZE = 100;
const MIN_CALL_INTERVAL_MS = 65_000;
const TASK_TYPE = "RETRIEVAL_DOCUMENT";

let lastCallAt = 0;

async function waitForRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastCallAt;
  const waitMs = MIN_CALL_INTERVAL_MS - elapsed;

  if (waitMs > 0) {
    await new Promise((resolve) =>
      setTimeout(resolve, waitMs),
    );
  }
}

interface EnrichedChunk extends Chunk {
  source: string;
  document_type: string;
  doc_number: number;
  doc_year: number;
  corpus_version: string;
  content_type: string;
  context_header: string;
}

interface EmbeddedChunk extends EnrichedChunk {
  embedding: number[];
  embedding_model: string;
  embedding_dimension: number;
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

const META_KEYS = [
  "source",
  "document_type",
  "doc_number",
  "doc_year",
  "corpus_version",
  "content_type",
] as const;

async function embedChunks(
  chunks: EnrichedChunk[],
  docId: string,
): Promise<number[][]> {
  const embedder = createEmbedder({
    taskType: TASK_TYPE,
  });

  const total = chunks.length;
  const embeddings: number[][] = [];
  const batches = Math.ceil(total / BATCH_SIZE);

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = chunks
      .slice(i, i + BATCH_SIZE)
      .map((chunk) =>
        chunk.context_header
          ? `${chunk.context_header}\n\n${chunk.text}`
          : chunk.text,
      );

    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    console.log(
      `  batch ${batchNumber}/${batches} (${batch.length} chunk)...`,
    );

    await waitForRateLimit();

    const result = await embedder.embed(batch);

    lastCallAt = Date.now();

    embeddings.push(...result);

    console.log(
      `    selesai ${embeddings.length}/${total}`,
    );
  }

  if (embeddings.length !== total) {
    throw new Error(
      `[${docId}] embedding tidak lengkap: ${embeddings.length}/${total}`,
    );
  }

  return embeddings;
}

function validate(
  output: EmbeddedChunk[],
  input: EnrichedChunk[],
): { valid: boolean; summary: string } {
  let missing = 0;
  let badDimension = 0;
  let badNumber = 0;
  let modelBad = 0;

  for (const chunk of output) {
    if (!chunk.embedding) {
      missing++;
      continue;
    }

    if (chunk.embedding.length !== DIMENSION) {
      badDimension++;
    }

    for (const value of chunk.embedding) {
      if (!Number.isFinite(value)) {
        badNumber++;
        break;
      }
    }

    if (chunk.embedding_model !== MODEL) {
      modelBad++;
    }

    if (chunk.embedding_dimension !== DIMENSION) {
      modelBad++;
    }
  }

  let identityDiff = 0;
  let metadataDiff = 0;

  for (let i = 0; i < input.length; i++) {
    const before = input[i];
    const after = output[i];

    if (after.chunk_id !== before.chunk_id) identityDiff++;
    if (after.text !== before.text) identityDiff++;

    for (const key of HIERARCHY_KEYS) {
      if (after[key] !== before[key]) identityDiff++;
    }

    for (const key of META_KEYS) {
      if (after[key] !== before[key]) metadataDiff++;
    }

    if (
      after.page_start !== before.page_start ||
      after.page_end !== before.page_end
    ) {
      identityDiff++;
    }
  }

  const duplicates =
    output.length -
    new Set(output.map((c) => c.chunk_id)).size;

  const valid =
    output.length === input.length &&
    missing === 0 &&
    badDimension === 0 &&
    badNumber === 0 &&
    modelBad === 0 &&
    identityDiff === 0 &&
    metadataDiff === 0 &&
    duplicates === 0;

  return {
    valid,
    summary:
      `missing=${missing} badDim=${badDimension} badNum=${badNumber} ` +
      `modelBad=${modelBad} identityDiff=${identityDiff} metadataDiff=${metadataDiff} duplicates=${duplicates}`,
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

  fs.mkdirSync(CHUNKS_DIR, { recursive: true });

  console.log(
    `[embed] ${enabled.length} dokumen aktif (taskType=${TASK_TYPE})`,
  );

  let failures = 0;

  for (const doc of enabled) {
    const inputPath = path.join(
      CHUNKS_DIR,
      `${doc.document_id}.enriched.json`,
    );

    const outputPath = path.join(
      CHUNKS_DIR,
      `${doc.document_id}.embedded.json`,
    );

    if (!fs.existsSync(inputPath)) {
      console.error(
        `[${doc.document_id}] input tidak ditemukan: ${inputPath}\n` +
          '  → jalankan "npm run enrich" lebih dulu.',
      );

      failures++;
      continue;
    }

    const inputSha = await sha256File(inputPath);

    const signature = `${inputSha}:${MODEL}:${DIMENSION}:${TASK_TYPE}`;

    const entry =
      manifest.documents[doc.document_id] ?? baseEntry(doc.document_id);

    if (
      fs.existsSync(outputPath) &&
      entry.embedded_signature === signature
    ) {
      console.log(
        `[${doc.document_id}] skip: embedding sudah ada & signature cocok`,
      );
      continue;
    }

    const chunks = JSON.parse(
      fs.readFileSync(inputPath, "utf-8"),
    ) as EnrichedChunk[];

    console.log(
      `[${doc.document_id}] embed ${chunks.length} chunk`,
    );

    try {
      const embeddings = await embedChunks(
        chunks,
        doc.document_id,
      );

      const output: EmbeddedChunk[] = chunks.map(
        (chunk, index) => ({
          ...chunk,
          embedding: embeddings[index],
          embedding_model: MODEL,
          embedding_dimension: DIMENSION,
        }),
      );

      const report = validate(output, chunks);

      if (!report.valid) {
        console.error(`  VALIDASI GAGAL: ${report.summary}`);
        failures++;
        continue;
      }

      fs.writeFileSync(
        outputPath,
        JSON.stringify(output, null, 2),
        "utf-8",
      );

      manifest.documents[doc.document_id] = {
        ...entry,
        embedded_at: new Date().toISOString(),
        embedded_signature: signature,
      };

      console.log(`  OK ${report.summary}`);
      console.log(`  → ${outputPath}`);
    } catch (error) {
      failures++;
      console.error(
        `  GAGAL: ${(error as Error).message}`,
      );
    }
  }

  manifest.generated_at = new Date().toISOString();
  saveManifest(manifest);

  if (failures > 0) {
    console.error(`\nGagal: ${failures} dokumen.`);
    process.exit(1);
  }

  console.log("\nSTEP 6 (embed) : PASS");
}

main().catch((error) => {
  console.error("Gagal:", error);
  process.exit(1);
});
