import fs from "node:fs/promises";
import path from "node:path";
import * as lancedb from "@lancedb/lancedb";

const ROOT_DIR = process.cwd();

const DB_PATH = path.join(ROOT_DIR, "data", "lancedb");
const TABLE_NAME = "uu27_2022";

const INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "chunks",
  "uu27-2022.embedded.json"
);

const EXPECTED_DIMENSION = 768;

// Toleransi karena vector di LanceDB dapat disimpan sebagai float32,
// sedangkan JSON menyimpan angka dengan precision JavaScript.
const VECTOR_TOLERANCE = 1e-5;

type EmbeddedChunk = {
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
  source: string;
  document_type: string;
  corpus_version: string;
  content_type: string;
  embedding: number[];
  embedding_model: string;
  embedding_dimension: number;
};

type LanceRow = Record<string, unknown>;

function getVectorLength(vector: unknown): number {
  if (vector === null || vector === undefined) {
    return 0;
  }

  const candidate = vector as {
    length?: unknown;
  };

  return typeof candidate.length === "number"
    ? candidate.length
    : 0;
}

function getVectorValue(vector: unknown, index: number): number {
  const candidate = vector as {
    get?: (index: number) => unknown;
    [key: number]: unknown;
  };

  if (typeof candidate.get === "function") {
    return Number(candidate.get(index));
  }

  return Number(candidate[index]);
}

function valuesEqual(
  expected: unknown,
  actual: unknown
): boolean {
  return Object.is(expected, actual);
}

function compareField(
  field: string,
  expected: unknown,
  actual: unknown
): string | null {
  if (!valuesEqual(expected, actual)) {
    return `${field}: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`;
  }

  return null;
}

async function main() {
  console.log("==============================================");
  console.log(" FINAL VERIFICATION — JSON vs LANCEDB");
  console.log("==============================================");

  // ============================================================
  // 1. BACA EMBEDDED JSON
  // ============================================================

  console.log("\n[1/5] Membaca embedded JSON...");

  const rawJson = await fs.readFile(INPUT_PATH, "utf8");

  const expected: EmbeddedChunk[] = JSON.parse(rawJson);

  console.log(`✓ Embedded JSON berhasil dibaca`);
  console.log(`✓ Jumlah record JSON: ${expected.length}`);

  // ============================================================
  // 2. VALIDASI JSON
  // ============================================================

  console.log("\n[2/5] Validasi embedded JSON...");

  if (expected.length !== 251) {
    throw new Error(
      `Jumlah JSON tidak sesuai. Expected 251, actual ${expected.length}`
    );
  }

  const expectedIds = new Set<string>();

  for (const chunk of expected) {
    if (expectedIds.has(chunk.chunk_id)) {
      throw new Error(
        `Duplicate chunk_id pada JSON: ${chunk.chunk_id}`
      );
    }

    expectedIds.add(chunk.chunk_id);

    if (!chunk.text || chunk.text.trim() === "") {
      throw new Error(
        `Text kosong pada JSON: ${chunk.chunk_id}`
      );
    }

    if (chunk.embedding.length !== EXPECTED_DIMENSION) {
      throw new Error(
        `Embedding dimension salah pada ${chunk.chunk_id}: ${chunk.embedding.length}`
      );
    }
  }

  console.log("✓ Jumlah JSON: 251");
  console.log("✓ Tidak ada duplicate chunk_id");
  console.log("✓ Semua text tidak kosong");
  console.log("✓ Semua embedding memiliki 768 dimensi");

  // ============================================================
  // 3. CONNECT LANCEDB
  // ============================================================

  console.log("\n[3/5] Membuka LanceDB...");

  const db = await lancedb.connect(DB_PATH);

  const table = await db.openTable(TABLE_NAME);

  const lanceCount = await table.countRows();

  console.log(`✓ LanceDB berhasil dibuka`);
  console.log(`✓ Jumlah row LanceDB: ${lanceCount}`);

  if (lanceCount !== expected.length) {
    throw new Error(
      `Jumlah row berbeda. JSON=${expected.length}, LanceDB=${lanceCount}`
    );
  }

  // ============================================================
  // 4. BACA SEMUA ROW DARI LANCEDB
  // ============================================================

  console.log("\n[4/5] Membaca seluruh data dari LanceDB...");

  const actualRows = (await table.query().toArray()) as LanceRow[];

  console.log(`✓ Berhasil membaca ${actualRows.length} row`);

  if (actualRows.length !== expected.length) {
    throw new Error(
      `Jumlah row berbeda setelah query. JSON=${expected.length}, LanceDB=${actualRows.length}`
    );
  }

  // Map LanceDB berdasarkan chunk_id
  const actualById = new Map<string, LanceRow>();

  for (const row of actualRows) {
    const chunkId = String(row.chunk_id);

    if (actualById.has(chunkId)) {
      throw new Error(
        `Duplicate chunk_id di LanceDB: ${chunkId}`
      );
    }

    actualById.set(chunkId, row);
  }

  // ============================================================
  // 5. COMPARE 251 RECORD
  // ============================================================

  console.log("\n[5/5] Membandingkan JSON dengan LanceDB...");

  let identityErrors = 0;
  let vectorErrors = 0;
  let missingRows = 0;

  let totalVectorValues = 0;
  let vectorValuesWithinTolerance = 0;

  const identityFields = [
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
    "text",
    "source",
    "document_type",
    "corpus_version",
    "content_type",
    "embedding_model",
    "embedding_dimension"
  ] as const;

  for (const expectedChunk of expected) {
    const chunkId = expectedChunk.chunk_id;

    const actual = actualById.get(chunkId);

    // ----------------------------------------------------------
    // Row tidak ditemukan
    // ----------------------------------------------------------

    if (!actual) {
      console.error(`✗ Row tidak ditemukan di LanceDB: ${chunkId}`);
      missingRows++;
      continue;
    }

    // ----------------------------------------------------------
    // Compare metadata + text
    // ----------------------------------------------------------

    for (const field of identityFields) {
      const expectedValue = expectedChunk[field];
      const actualValue = actual[field];

      const error = compareField(
        field,
        expectedValue,
        actualValue
      );

      if (error) {
        identityErrors++;

        if (identityErrors <= 10) {
          console.error(
            `✗ ${chunkId} → ${error}`
          );
        }
      }
    }

    // ----------------------------------------------------------
    // Compare vector
    // ----------------------------------------------------------

    const expectedVector = expectedChunk.embedding;
    const actualVector = actual.vector;

    const actualDimension = getVectorLength(actualVector);

    if (actualDimension !== EXPECTED_DIMENSION) {
      vectorErrors++;

      if (vectorErrors <= 10) {
        console.error(
          `✗ ${chunkId} → vector dimension ${actualDimension}, expected ${EXPECTED_DIMENSION}`
        );
      }

      continue;
    }

    for (let i = 0; i < EXPECTED_DIMENSION; i++) {
      const expectedValue = Number(expectedVector[i]);
      const actualValue = getVectorValue(actualVector, i);

      totalVectorValues++;

      if (!Number.isFinite(actualValue)) {
        vectorErrors++;

        if (vectorErrors <= 10) {
          console.error(
            `✗ ${chunkId} → vector[${i}] bukan finite: ${actualValue}`
          );
        }

        continue;
      }

      const difference = Math.abs(
        expectedValue - actualValue
      );

      if (difference <= VECTOR_TOLERANCE) {
        vectorValuesWithinTolerance++;
      } else {
        vectorErrors++;

        if (vectorErrors <= 10) {
          console.error(
            `✗ ${chunkId} → vector[${i}] berbeda. ` +
            `expected=${expectedValue}, actual=${actualValue}, diff=${difference}`
          );
        }
      }
    }
  }

  // ============================================================
  // FINAL RESULT
  // ============================================================

  console.log("\n==============================================");
  console.log(" HASIL VERIFIKASI");
  console.log("==============================================");

  console.log(`JSON records              : ${expected.length}`);
  console.log(`LanceDB rows              : ${actualRows.length}`);
  console.log(`Missing rows              : ${missingRows}`);
  console.log(`Identity/text errors      : ${identityErrors}`);
  console.log(`Vector errors             : ${vectorErrors}`);
  console.log(
    `Vector values dibandingkan: ${totalVectorValues}`
  );
  console.log(
    `Vector values within tol. : ${vectorValuesWithinTolerance}`
  );
  console.log(
    `Vector tolerance          : ${VECTOR_TOLERANCE}`
  );

  // ============================================================
  // SUCCESS / FAIL
  // ============================================================

  if (
    missingRows === 0 &&
    identityErrors === 0 &&
    vectorErrors === 0 &&
    vectorValuesWithinTolerance === totalVectorValues
  ) {
    console.log("\n==============================================");
    console.log(" VERIFIKASI BERHASIL");
    console.log("==============================================");

    console.log("✓ 251/251 row ditemukan");
    console.log("✓ Semua chunk_id sama");
    console.log("✓ Semua text sama");
    console.log("✓ Semua metadata sama");
    console.log("✓ Semua page provenance sama");
    console.log("✓ Semua embedding memiliki 768 dimensi");
    console.log("✓ Semua nilai vector sesuai");
    console.log("✓ Tidak ada data yang hilang");
    console.log("✓ Tidak ada data tambahan");
    console.log("✓ LanceDB sesuai dengan embedded JSON");

    console.log("\nDATABASE SIAP DI-HANDOFF KE YUDA.");

    return;
  }

  console.log("\n==============================================");
  console.log(" VERIFIKASI GAGAL");
  console.log("==============================================");

  console.log(
    "Ada perbedaan antara embedded JSON dan LanceDB."
  );

  process.exit(1);
}

main().catch((error: unknown) => {
  console.error("\n==============================================");
  console.error(" ERROR");
  console.error("==============================================");

  console.error(error);

  process.exit(1);
});