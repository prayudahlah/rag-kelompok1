import fs from "node:fs/promises";
import path from "node:path";
import * as lancedb from "@lancedb/lancedb";

// ============================================================
// CONFIGURATION
// ============================================================

const ROOT_DIR = process.cwd();

const INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "chunks",
  "uu27-2022.embedded.json"
);

const DB_PATH = path.join(
  ROOT_DIR,
  "data",
  "lancedb"
);

const TABLE_NAME = "uu27_2022";

const EXPECTED_EMBEDDING_MODEL =
  "gemini-embedding-001";

const EXPECTED_DIMENSION = 768;

const EXPECTED_CHUNK_COUNT = 251;

// ============================================================
// TYPES
// ============================================================

interface EmbeddedChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;

  section: string | null;

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

  source: string;
  document_type: string;
  corpus_version: string;
  content_type: string;

  embedding: number[];

  embedding_model: string;
  embedding_dimension: number;
}

interface LanceRow {
  vector: number[];

  text: string;

  chunk_id: string;
  document_id: string;
  document_title: string;

  section: string | null;

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

  source: string;
  document_type: string;
  corpus_version: string;
  content_type: string;

  embedding_model: string;
  embedding_dimension: number;
}

// ============================================================
// HELPERS
// ============================================================

function getVectorLength(
  vector: unknown
): number {
  if (
    vector === null ||
    vector === undefined
  ) {
    return 0;
  }

  const candidate = vector as {
    length?: unknown;
  };

  if (
    typeof candidate.length !== "number"
  ) {
    return 0;
  }

  return candidate.length;
}

/**
 * LanceDB mengembalikan vector sebagai Arrow Vector.
 *
 * Arrow Vector bukan JavaScript Array biasa.
 *
 * Karena itu:
 *
 *   vector[i]
 *
 * tidak digunakan.
 *
 * Kita menggunakan:
 *
 *   vector.get(i)
 *
 * jika method tersebut tersedia.
 */
function getVectorValue(
  vector: unknown,
  index: number
): number {
  const candidate = vector as {
    get?: (index: number) => unknown;
    [key: number]: unknown;
  };

  if (
    typeof candidate.get === "function"
  ) {
    return Number(
      candidate.get(index)
    );
  }

  return Number(
    candidate[index]
  );
}

// ============================================================
// STEP 1 — LOAD EMBEDDED JSON
// ============================================================

async function loadEmbeddedData(): Promise<
  EmbeddedChunk[]
> {
  console.log(
    "[1/6] Membaca embedded JSON..."
  );

  console.log(
    `Input: ${INPUT_PATH}`
  );

  try {
    await fs.access(INPUT_PATH);
  } catch {
    throw new Error(
      `File input tidak ditemukan:\n${INPUT_PATH}`
    );
  }

  const raw =
    await fs.readFile(
      INPUT_PATH,
      "utf-8"
    );

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "File embedded JSON tidak valid. Gagal melakukan JSON.parse()."
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "Format embedded JSON harus berupa array."
    );
  }

  console.log(
    "✓ JSON berhasil dibaca"
  );

  console.log(
    `✓ Jumlah record: ${data.length}`
  );

  return data as EmbeddedChunk[];
}

// ============================================================
// STEP 2 — VALIDATE EMBEDDED DATA
// ============================================================

function validateEmbeddedData(
  chunks: EmbeddedChunk[]
): void {
  console.log(
    "\n[2/6] Validasi embedded data..."
  );

  if (chunks.length === 0) {
    throw new Error(
      "Embedded data kosong."
    );
  }

  if (
    chunks.length !==
    EXPECTED_CHUNK_COUNT
  ) {
    throw new Error(
      `Jumlah chunk tidak sesuai.\n` +
      `Expected: ${EXPECTED_CHUNK_COUNT}\n` +
      `Actual: ${chunks.length}`
    );
  }

  const ids =
    new Set<string>();

  for (
    let i = 0;
    i < chunks.length;
    i++
  ) {
    const chunk =
      chunks[i];

    // --------------------------------------------------------
    // chunk_id
    // --------------------------------------------------------

    if (
      typeof chunk.chunk_id !==
        "string" ||
      chunk.chunk_id.trim() === ""
    ) {
      throw new Error(
        `Chunk index ${i} tidak memiliki chunk_id.`
      );
    }

    if (
      ids.has(
        chunk.chunk_id
      )
    ) {
      throw new Error(
        `Duplicate chunk_id ditemukan: ${chunk.chunk_id}`
      );
    }

    ids.add(
      chunk.chunk_id
    );

    // --------------------------------------------------------
    // text
    // --------------------------------------------------------

    if (
      typeof chunk.text !==
        "string" ||
      chunk.text.trim() === ""
    ) {
      throw new Error(
        `Chunk ${chunk.chunk_id} memiliki text kosong.`
      );
    }

    // --------------------------------------------------------
    // embedding
    // --------------------------------------------------------

    if (
      !Array.isArray(
        chunk.embedding
      )
    ) {
      throw new Error(
        `Chunk ${chunk.chunk_id} tidak memiliki embedding array.`
      );
    }

    if (
      chunk.embedding.length !==
      EXPECTED_DIMENSION
    ) {
      throw new Error(
        `Dimensi embedding salah pada ${chunk.chunk_id}.\n` +
        `Expected: ${EXPECTED_DIMENSION}\n` +
        `Actual: ${chunk.embedding.length}`
      );
    }

    // --------------------------------------------------------
    // finite embedding
    // --------------------------------------------------------

    for (
      let j = 0;
      j < chunk.embedding.length;
      j++
    ) {
      const value =
        chunk.embedding[j];

      if (
        typeof value !==
          "number" ||
        !Number.isFinite(value)
      ) {
        throw new Error(
          `Embedding ${chunk.chunk_id} memiliki nilai tidak valid ` +
          `pada index ${j}: ${value}`
        );
      }
    }

    // --------------------------------------------------------
    // embedding model
    // --------------------------------------------------------

    if (
      chunk.embedding_model !==
      EXPECTED_EMBEDDING_MODEL
    ) {
      throw new Error(
        `Model embedding tidak sesuai pada ${chunk.chunk_id}.\n` +
        `Expected: ${EXPECTED_EMBEDDING_MODEL}\n` +
        `Actual: ${chunk.embedding_model}`
      );
    }

    // --------------------------------------------------------
    // embedding dimension metadata
    // --------------------------------------------------------

    if (
      chunk.embedding_dimension !==
      EXPECTED_DIMENSION
    ) {
      throw new Error(
        `Metadata dimension tidak sesuai pada ${chunk.chunk_id}.\n` +
        `Expected: ${EXPECTED_DIMENSION}\n` +
        `Actual: ${chunk.embedding_dimension}`
      );
    }
  }

  console.log(
    `✓ Jumlah chunk: ${chunks.length}`
  );

  console.log(
    "✓ Tidak ada duplicate chunk_id"
  );

  console.log(
    "✓ Semua text tidak kosong"
  );

  console.log(
    `✓ Semua embedding memiliki ${EXPECTED_DIMENSION} dimensi`
  );

  console.log(
    "✓ Semua nilai embedding finite"
  );

  console.log(
    `✓ Model embedding: ${EXPECTED_EMBEDDING_MODEL}`
  );
}

// ============================================================
// STEP 3 — TRANSFORM DATA
// ============================================================

function transformToLanceRows(
  chunks: EmbeddedChunk[]
): LanceRow[] {
  console.log(
    "\n[3/6] Menyiapkan data untuk LanceDB..."
  );

  const rows: LanceRow[] =
    chunks.map(
      (chunk) => {
        /**
         * Gunakan number[] asli dari embedded JSON.
         *
         * Tidak perlu mengubahnya menjadi Float32Array
         * secara manual di sini.
         *
         * LanceDB akan menangani representasi vector
         * pada storage Arrow/Lance.
         */

        const vector =
          chunk.embedding;

        // ------------------------------------------------------
        // Validate vector BEFORE insertion
        // ------------------------------------------------------

        if (
          vector.length !==
          EXPECTED_DIMENSION
        ) {
          throw new Error(
            `Vector hasil transform salah pada ${chunk.chunk_id}.`
          );
        }

        for (
          let i = 0;
          i < vector.length;
          i++
        ) {
          if (
            !Number.isFinite(
              vector[i]
            )
          ) {
            throw new Error(
              `Vector hasil transform memiliki nilai non-finite ` +
              `pada ${chunk.chunk_id}, index ${i}.`
            );
          }
        }

        return {
          vector,

          text:
            chunk.text,

          chunk_id:
            chunk.chunk_id,

          document_id:
            chunk.document_id,

          document_title:
            chunk.document_title,

          section:
            chunk.section,

          bab:
            chunk.bab,

          bab_title:
            chunk.bab_title,

          bagian:
            chunk.bagian,

          pasal:
            chunk.pasal,

          pasal_number:
            chunk.pasal_number,

          ayat:
            chunk.ayat,

          ayat_number:
            chunk.ayat_number,

          angka:
            chunk.angka,

          page_start:
            chunk.page_start,

          page_end:
            chunk.page_end,

          source:
            chunk.source,

          document_type:
            chunk.document_type,

          corpus_version:
            chunk.corpus_version,

          content_type:
            chunk.content_type,

          embedding_model:
            chunk.embedding_model,

          embedding_dimension:
            chunk.embedding_dimension,
        };
      }
    );

  console.log(
    `✓ ${rows.length} row siap dimasukkan`
  );

  console.log(
    "✓ Vector menggunakan number[]"
  );

  console.log(
    `✓ Dimensi vector: ${EXPECTED_DIMENSION}`
  );

  return rows;
}

// ============================================================
// STEP 4 — CONNECT TO LANCEDB
// ============================================================

async function connectDatabase() {
  console.log(
    "\n[4/6] Membuka LanceDB..."
  );

  await fs.mkdir(
    DB_PATH,
    {
      recursive: true,
    }
  );

  console.log(
    `Database path: ${DB_PATH}`
  );

  const db =
    await lancedb.connect(
      DB_PATH
    );

  console.log(
    "✓ Berhasil terhubung ke LanceDB"
  );

  return db;
}

// ============================================================
// STEP 5 — CREATE / REPLACE TABLE
// ============================================================

async function createOrReplaceTable(
  db: Awaited<
    ReturnType<
      typeof lancedb.connect
    >
  >,
  rows: LanceRow[]
) {
  console.log(
    "\n[5/6] Membuat / mengganti table..."
  );

  const existingTables =
    await db.tableNames();

  if (
    existingTables.includes(
      TABLE_NAME
    )
  ) {
    console.log(
      `Table "${TABLE_NAME}" sudah ada.`
    );

    console.log(
      `Menghapus table "${TABLE_NAME}" agar tidak terjadi duplicate...`
    );

    await db.dropTable(
      TABLE_NAME
    );

    console.log(
      "✓ Table lama dihapus"
    );
  }

  console.log(
    `Membuat table "${TABLE_NAME}"...`
  );

  const table =
    await db.createTable(
      TABLE_NAME,
      rows as unknown as Record<
        string,
        unknown
      >[]
    );

  console.log(
    `✓ Table "${TABLE_NAME}" berhasil dibuat`
  );

  return table;
}

// ============================================================
// STEP 6 — VALIDATE LANCEDB TABLE
// ============================================================

async function validateInsertedTable(
  table: any
): Promise<void> {
  console.log(
    "\n[6/6] Memvalidasi isi LanceDB..."
  );

  // ----------------------------------------------------------
  // Row count
  // ----------------------------------------------------------

  const rowCount =
    await table.countRows();

  console.log(
    `Jumlah row di LanceDB: ${rowCount}`
  );

  if (
    rowCount !==
    EXPECTED_CHUNK_COUNT
  ) {
    throw new Error(
      `Jumlah row LanceDB tidak sesuai.\n` +
      `Expected: ${EXPECTED_CHUNK_COUNT}\n` +
      `Actual: ${rowCount}`
    );
  }

  // ----------------------------------------------------------
  // Get sample row
  // ----------------------------------------------------------

  const sampleRows =
    await table
      .query()
      .limit(1)
      .toArray();

  if (
    sampleRows.length !== 1
  ) {
    throw new Error(
      "Tidak dapat mengambil sample row dari LanceDB."
    );
  }

  const sample =
    sampleRows[0];

  // ----------------------------------------------------------
  // Vector existence
  // ----------------------------------------------------------

  if (
    sample.vector ===
      undefined ||
    sample.vector ===
      null
  ) {
    throw new Error(
      "Field 'vector' tidak ditemukan di LanceDB."
    );
  }

  // ----------------------------------------------------------
  // Vector length
  // ----------------------------------------------------------

  const vectorLength =
    getVectorLength(
      sample.vector
    );

  if (
    vectorLength === 0
  ) {
    throw new Error(
      "Field 'vector' ditemukan tetapi length tidak valid."
    );
  }

  if (
    vectorLength !==
    EXPECTED_DIMENSION
  ) {
    throw new Error(
      `Dimensi vector LanceDB salah.\n` +
      `Expected: ${EXPECTED_DIMENSION}\n` +
      `Actual: ${vectorLength}`
    );
  }

  // ----------------------------------------------------------
  // Vector diagnostics
  // ----------------------------------------------------------

  console.log(
    `Vector type dari LanceDB: ${
      sample.vector?.constructor?.name ??
      "unknown"
    }`
  );

  console.log(
    `Vector length: ${vectorLength}`
  );

  const firstValues: number[] =
    [];

  for (
    let i = 0;
    i < Math.min(
      10,
      vectorLength
    );
    i++
  ) {
    firstValues.push(
      getVectorValue(
        sample.vector,
        i
      )
    );
  }

  console.log(
    "10 nilai pertama vector:",
    firstValues
  );

  // ----------------------------------------------------------
  // Validate vector values
  // ----------------------------------------------------------

  for (
    let i = 0;
    i < vectorLength;
    i++
  ) {
    const value =
      getVectorValue(
        sample.vector,
        i
      );

    if (
      !Number.isFinite(value)
    ) {
      throw new Error(
        `Vector LanceDB mengandung nilai non-finite ` +
        `pada index ${i}: ${value}`
      );
    }
  }

  console.log(
    "✓ Semua nilai vector finite"
  );

  // ----------------------------------------------------------
  // Validate text
  // ----------------------------------------------------------

  if (
    typeof sample.text !==
      "string" ||
    sample.text.trim() === ""
  ) {
    throw new Error(
      "Field 'text' kosong atau tidak valid."
    );
  }

  console.log(
    "✓ Text ditemukan dan valid"
  );

  // ----------------------------------------------------------
  // Required metadata
  // ----------------------------------------------------------

  const requiredFields = [
    "chunk_id",
    "document_id",
    "document_title",
    "section",
    "bab",
    "bab_title",
    "bagian",
    "pasal",
    "pasal_number",
    "ayat",
    "ayat_number",
    "angka",
    "page_start",
    "page_end",
    "source",
    "document_type",
    "corpus_version",
    "content_type",
    "embedding_model",
    "embedding_dimension",
  ];

  for (
    const field of
      requiredFields
  ) {
    if (
      !(field in sample)
    ) {
      throw new Error(
        `Field metadata '${field}' tidak ditemukan di LanceDB.`
      );
    }
  }

  console.log(
    "✓ Semua field metadata ditemukan"
  );

  // ----------------------------------------------------------
  // Validate embedding metadata
  // ----------------------------------------------------------

  if (
    sample.embedding_model !==
    EXPECTED_EMBEDDING_MODEL
  ) {
    throw new Error(
      `Model embedding di LanceDB tidak sesuai.\n` +
      `Expected: ${EXPECTED_EMBEDDING_MODEL}\n` +
      `Actual: ${sample.embedding_model}`
    );
  }

  if (
    sample.embedding_dimension !==
    EXPECTED_DIMENSION
  ) {
    throw new Error(
      `Embedding dimension di LanceDB tidak sesuai.\n` +
      `Expected: ${EXPECTED_DIMENSION}\n` +
      `Actual: ${sample.embedding_dimension}`
    );
  }

  console.log(
    `✓ Model embedding: ${EXPECTED_EMBEDDING_MODEL}`
  );

  console.log(
    `✓ Dimension metadata: ${EXPECTED_DIMENSION}`
  );

  // ----------------------------------------------------------
  // SUCCESS
  // ----------------------------------------------------------

  console.log(
    "\n✓ Jumlah row benar: 251"
  );

  console.log(
    "✓ Vector ditemukan"
  );

  console.log(
    "✓ Dimensi vector: 768"
  );

  console.log(
    "✓ Semua nilai vector valid"
  );

  console.log(
    "✓ Text ditemukan"
  );

  console.log(
    "✓ Metadata lengkap"
  );
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  console.log(
    "=============================================="
  );

  console.log(
    " STEP 10 — INSERT DATA INTO LANCEDB"
  );

  console.log(
    "=============================================="
  );

  console.log(
    `Input : ${INPUT_PATH}`
  );

  console.log(
    `DB    : ${DB_PATH}`
  );

  console.log(
    `Table : ${TABLE_NAME}`
  );

  // ----------------------------------------------------------
  // 1. Load embedded JSON
  // ----------------------------------------------------------

  const chunks =
    await loadEmbeddedData();

  // ----------------------------------------------------------
  // 2. Validate embedded data
  // ----------------------------------------------------------

  validateEmbeddedData(
    chunks
  );

  // ----------------------------------------------------------
  // 3. Transform
  // ----------------------------------------------------------

  const rows =
    transformToLanceRows(
      chunks
    );

  // ----------------------------------------------------------
  // 4. Connect database
  // ----------------------------------------------------------

  const db =
    await connectDatabase();

  // ----------------------------------------------------------
  // 5. Create table
  // ----------------------------------------------------------

  const table =
    await createOrReplaceTable(
      db,
      rows
    );

  // ----------------------------------------------------------
  // 6. Validate table
  // ----------------------------------------------------------

  await validateInsertedTable(
    table
  );

  // ----------------------------------------------------------
  // FINAL SUCCESS
  // ----------------------------------------------------------

  console.log(
    "\n=============================================="
  );

  console.log(
    " STEP 10 BERHASIL"
  );

  console.log(
    "=============================================="
  );

  console.log(
    `Database : ${DB_PATH}`
  );

  console.log(
    `Table    : ${TABLE_NAME}`
  );

  console.log(
    `Rows     : ${EXPECTED_CHUNK_COUNT}`
  );

  console.log(
    `Vector   : ${EXPECTED_DIMENSION} dimensions`
  );

  console.log(
    "\nPipeline sekarang:"
  );

  console.log(
    "PDF → Parsing → Cleaning → Chunking → Metadata"
  );

  console.log(
    "→ Embedding → LanceDB ✓"
  );

  console.log(
    "\nData siap digunakan oleh bagian Retrieval."
  );
}

// ============================================================
// ERROR HANDLER
// ============================================================

main().catch(
  (error: unknown) => {
    console.error(
      "\n=============================================="
    );

    console.error(
      " STEP 10 GAGAL"
    );

    console.error(
      "=============================================="
    );

    if (
      error instanceof Error
    ) {
      console.error(
        error.message
      );

      if (error.stack) {
        console.error(
          "\nStack:"
        );

        console.error(
          error.stack
        );
      }
    } else {
      console.error(
        error
      );
    }

    process.exit(1);
  }
);