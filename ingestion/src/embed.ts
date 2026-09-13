import "dotenv/config";

import fs from "fs";
import path from "path";

import type { Chunk } from "./types.js";
import {
  createEmbedder,
  MODEL,
  DIMENSION,
} from "./embedder.js";

const INPUT_PATH = path.resolve(
  "data/chunks/uu27-2022.enriched.json",
);

const OUTPUT_PATH = path.resolve(
  "data/chunks/uu27-2022.embedded.json",
);

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 61_000;

interface EnrichedChunk extends Chunk {
  source: string;
  document_type: string;
  corpus_version: string;
  content_type: string;
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
  "corpus_version",
  "content_type",
] as const;

async function main(): Promise<void> {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(
      `Input tidak ditemukan: ${INPUT_PATH}`,
    );

    process.exit(1);
  }

  const chunks = JSON.parse(
    fs.readFileSync(INPUT_PATH, "utf-8"),
  ) as EnrichedChunk[];

  const duplicateIds =
    chunks.length -
    new Set(
      chunks.map((chunk) => chunk.chunk_id),
    ).size;

  const emptyText = chunks.filter(
    (chunk) => chunk.text.trim() === "",
  ).length;

  if (duplicateIds !== 0) {
    console.error(
      `Input invalid: duplicate chunk_id = ${duplicateIds}`,
    );

    process.exit(1);
  }

  if (emptyText !== 0) {
    console.error(
      `Input invalid: empty text = ${emptyText}`,
    );

    process.exit(1);
  }

  console.log(`Input : ${chunks.length} chunks`);

  const embedder = createEmbedder();

  const total = chunks.length;
  const embeddings: number[][] = [];

  const batches = Math.ceil(
    total / BATCH_SIZE,
  );

  for (
    let i = 0;
    i < total;
    i += BATCH_SIZE
  ) {
    const batch = chunks
      .slice(i, i + BATCH_SIZE)
      .map((chunk) => chunk.text);

    const batchNumber =
      Math.floor(i / BATCH_SIZE) + 1;

    console.log(
      `Batch ${batchNumber}/${batches} (${batch.length} chunk)...`,
    );

    const batchEmbeddings =
      await embedder.embed(batch);

    embeddings.push(...batchEmbeddings);

    console.log(
      `  selesai ${embeddings.length}/${total}`,
    );

    if (i + BATCH_SIZE < total) {
      console.log(
        `  menunggu ${
          BATCH_DELAY_MS / 1000
        } detik sebelum batch berikutnya...`,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, BATCH_DELAY_MS),
      );
    }
  }

  if (embeddings.length !== total) {
    console.error(
      `Embedding tidak lengkap: ${embeddings.length}/${total}`,
    );

    process.exit(1);
  }

  const output: EmbeddedChunk[] =
    chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
      embedding_model: MODEL,
      embedding_dimension: DIMENSION,
    }));

  validate(output, chunks);

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(output, null, 2),
    "utf-8",
  );

  console.log("");
  console.log(`Output : ${OUTPUT_PATH}`);
  console.log(`Total  : ${output.length} record`);
  console.log(`STEP 9 : PASS`);
}

function validate(
  output: EmbeddedChunk[],
  input: EnrichedChunk[],
): void {
  let missing = 0;
  let empty = 0;
  let badDimension = 0;
  let badNumber = 0;
  let modelBad = 0;
  let dimensionMetadataBad = 0;

  for (const chunk of output) {
    if (!chunk.embedding) {
      missing++;
      continue;
    }

    if (chunk.embedding.length === 0) {
      empty++;
    }

    if (
      chunk.embedding.length !== DIMENSION
    ) {
      badDimension++;
    }

    for (const value of chunk.embedding) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        badNumber++;
        break;
      }
    }

    if (
      chunk.embedding_model !== MODEL
    ) {
      modelBad++;
    }

    if (
      chunk.embedding_dimension !== DIMENSION
    ) {
      dimensionMetadataBad++;
    }
  }

  let idDiff = 0;
  let textDiff = 0;
  let hierarchyDiff = 0;
  let metadataDiff = 0;
  let pageDiff = 0;

  for (
    let i = 0;
    i < input.length;
    i++
  ) {
    const before = input[i];
    const after = output[i];

    if (
      after.chunk_id !== before.chunk_id
    ) {
      idDiff++;
    }

    if (after.text !== before.text) {
      textDiff++;
    }

    for (const key of HIERARCHY_KEYS) {
      if (after[key] !== before[key]) {
        hierarchyDiff++;
      }
    }

    for (const key of META_KEYS) {
      if (after[key] !== before[key]) {
        metadataDiff++;
      }
    }

    if (
      after.page_start !==
        before.page_start ||
      after.page_end !==
        before.page_end
    ) {
      pageDiff++;
    }
  }

  const duplicateIds =
    output.length -
    new Set(
      output.map(
        (chunk) => chunk.chunk_id,
      ),
    ).size;

  console.log("");
  console.log(
    "=== VALIDASI STEP 9 ===",
  );

  console.log(
    `records             : ${output.length}`,
  );

  console.log(
    `missing embedding   : ${missing}`,
  );

  console.log(
    `empty embedding     : ${empty}`,
  );

  console.log(
    `bad dimension       : ${badDimension}`,
  );

  console.log(
    `bad number/NaN/Inf  : ${badNumber}`,
  );

  console.log(
    `model konsisten     : ${
      modelBad === 0
        ? "PASS"
        : "FAIL"
    }`,
  );

  console.log(
    `dim metadata        : ${
      dimensionMetadataBad === 0
        ? "PASS"
        : "FAIL"
    }`,
  );

  console.log(
    `duplicate id        : ${duplicateIds}`,
  );

  console.log(
    `identity diff       : id=${idDiff} text=${textDiff} hierarchy=${hierarchyDiff} metadata=${metadataDiff} page=${pageDiff}`,
  );

  const allPass =
    output.length === input.length &&
    missing === 0 &&
    empty === 0 &&
    badDimension === 0 &&
    badNumber === 0 &&
    modelBad === 0 &&
    dimensionMetadataBad === 0 &&
    duplicateIds === 0 &&
    idDiff === 0 &&
    textDiff === 0 &&
    hierarchyDiff === 0 &&
    metadataDiff === 0 &&
    pageDiff === 0;

  if (!allPass) {
    console.error(
      "STEP 9 : FAIL",
    );

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Gagal:", error);
  process.exit(1);
});