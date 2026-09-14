// src/chunk.ts
// Structure-aware chunking for UU No. 27 Tahun 2022
// Step 7 – Structure-Aware Chunking

import type { Chunk } from "../utils/types.js";

const DOCUMENT_ID = "uu-27-2022";

const DOCUMENT_TITLE =
  "Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi";

type Section =
  | "pembukaan"
  | "batang_tubuh"
  | "pengesahan"
  | "penjelasan";

/* =========================================================
 * DETECTION HELPERS
 * ========================================================= */

/**
 * Deteksi marker halaman dari hasil LlamaParse.
 *
 * Contoh yang didukung:
 * --- Halaman 1 ---
 * --- Halaman 2 ---
 */
function detectPage(
  line: string,
): number | null {
  const match = line.match(
    /^---\s*Halaman\s+(\d+)\s*---$/i,
  );

  return match
    ? Number.parseInt(match[1], 10)
    : null;
}

/**
 * Deteksi BAB.
 *
 * Contoh:
 * BAB I
 * BAB II
 * BAB XVI
 */
function detectBab(
  line: string,
): string | null {
  const match = line.match(
    /^BAB\s+([IVXLCDM]+)\s*$/i,
  );

  return match ? `BAB ${match[1]}` : null;
}

/**
 * Deteksi heading Pasal.
 *
 * Contoh:
 * Pasal 1
 * Pasal 16
 * Pasal 76
 */
function detectPasal(
  line: string,
): {
  pasal: string;
  pasal_number: number;
} | null {
  const match = line.match(
    /^Pasal\s+(\d+)\s*$/i,
  );

  if (!match) {
    return null;
  }

  const pasalNumber =
    Number.parseInt(match[1], 10);

  return {
    pasal: `Pasal ${pasalNumber}`,
    pasal_number: pasalNumber,
  };
}

/**
 * Deteksi Bagian.
 *
 * Contoh:
 * Bagian Kesatu
 * Bagian Kedua
 * Bagian Ketiga
 */
function detectBagian(
  line: string,
): string | null {
  const match = line.match(
    /^Bagian\s+(.+)$/i,
  );

  return match
    ? `Bagian ${match[1].trim()}`
    : null;
}

/**
 * Deteksi awal ayat.
 *
 * Contoh:
 * (1) Pemrosesan Data Pribadi...
 * (2) ...
 */
function detectAyat(
  line: string,
): number | null {
  const match = line.match(
    /^\((\d+)\)\s+/,
  );

  return match
    ? Number.parseInt(match[1], 10)
    : null;
}

/**
 * Deteksi huruf.
 *
 * Contoh:
 * a. pemerolehan dan pengumpulan;
 * b. pengolahan;
 *
 * Huruf TIDAK dibuat menjadi chunk.
 */
function isHuruf(
  line: string,
): boolean {
  return /^[a-z]\.\s+/i.test(line);
}

/**
 * Deteksi angka definisi khusus Pasal 1.
 *
 * Contoh:
 * 1. Data Pribadi adalah...
 * 2. Data Pribadi Spesifik adalah...
 *
 * Hanya digunakan ketika sedang berada
 * di Pasal 1 dan belum berada di dalam ayat.
 */
function detectAngkaPasal1(
  line: string,
): number | null {
  const match = line.match(
    /^(\d+)\.\s+/,
  );

  if (!match) {
    return null;
  }

  const number =
    Number.parseInt(match[1], 10);

  return number >= 1 && number <= 11
    ? number
    : null;
}

/**
 * Deteksi awal bagian penjelasan.
 */
function isPenjelasan(
  line: string,
): boolean {
  return (
    /^PENJELASAN$/i.test(line) ||
    /^##\s+I\.\s*UMUM/i.test(line)
  );
}

/**
 * Deteksi heading "PASAL DEMI PASAL".
 */
function isPasalDemiPasal(
  line: string,
): boolean {
  return /^##\s+II\.\s*PASAL DEMI PASAL/i.test(
    line,
  );
}

/**
 * Heading markdown tidak boleh menjadi text
 * chunk apabila hanya merupakan struktur.
 */
function isMarkdownHeading(
  line: string,
): boolean {
  return /^#{2,6}\s+/.test(line);
}

/**
 * Mengambil judul BAB dari baris setelah BAB.
 *
 * Contoh:
 *
 * BAB V
 * PEMROSESAN DATA PRIBADI
 */
function cleanHeading(
  line: string,
): string {
  return line
    .replace(/^#{2,6}\s+/, "")
    .trim();
}

/* =========================================================
 * CHUNK BUILDER
 * ========================================================= */

interface ChunkContext {
  section: Section;

  bab: string | null;
  bab_title: string | null;

  bagian: string | null;

  pasal: string | null;
  pasal_number: number | null;

  ayat: string | null;
  ayat_number: number | null;

  angka: number | null;

  page_start: number | null;
  page_end: number | null;
}

/**
 * Membuat ID chunk.
 */
function makeChunkId(
  context: ChunkContext,
): string {
  const section =
    context.section;

  if (section === "pembukaan") {
    return `${DOCUMENT_ID}-pembukaan`;
  }

  if (section === "pengesahan") {
    return `${DOCUMENT_ID}-pengesahan`;
  }

  if (section === "penjelasan") {
    const pasal =
      context.pasal_number;

    if (pasal !== null) {
      return `${DOCUMENT_ID}-penjelasan-pasal-${pasal}`;
    }

    return `${DOCUMENT_ID}-penjelasan`;
  }

  const pasal =
    context.pasal_number;

  if (pasal === null) {
    return `${DOCUMENT_ID}-batang-tubuh`;
  }

  if (
    context.angka !== null &&
    pasal === 1
  ) {
    return `${DOCUMENT_ID}-batang-tubuh-pasal-1-angka-${context.angka}`;
  }

  if (
    context.ayat_number !== null
  ) {
    return `${DOCUMENT_ID}-batang-tubuh-pasal-${pasal}-ayat-${context.ayat_number}`;
  }

  return `${DOCUMENT_ID}-batang-tubuh-pasal-${pasal}`;
}

/**
 * Membuat object Chunk.
 */
function createChunk(
  context: ChunkContext,
  text: string,
): Chunk {
  if (
    context.page_start === null ||
    context.page_end === null
  ) {
    throw new Error(
      `Chunk tanpa page provenance: ${context.pasal ?? context.section}`,
    );
  }

  return {
    chunk_id:
      makeChunkId(context),

    document_id:
      DOCUMENT_ID,

    document_title:
      DOCUMENT_TITLE,

    section:
      context.section,

    bab:
      context.bab,

    bab_title:
      context.bab_title,

    bagian:
      context.bagian,

    pasal:
      context.pasal,

    pasal_number:
      context.pasal_number,

    ayat:
      context.ayat,

    ayat_number:
      context.ayat_number,

    angka:
      context.angka,

    page_start:
      context.page_start,

    page_end:
      context.page_end,

    text:
      text.trim(),
  };
}

/* =========================================================
 * MAIN CHUNKING
 * ========================================================= */

/**
 * Structure-aware chunking.
 *
 * Keputusan final Step 7:
 *
 * 1. Unit utama = Ayat.
 * 2. Jika Pasal tidak memiliki Ayat,
 *    fallback ke seluruh Pasal.
 * 3. Huruf tidak menjadi chunk terpisah.
 * 4. Pasal 1:
 *    angka 1–11 menjadi chunk terpisah,
 *    tetapi tetap metadata Pasal 1.
 * 5. Penjelasan dipisahkan dari batang tubuh.
 * 6. II. PASAL DEMI PASAL:
 *    satu chunk per Pasal.
 * 7. Page provenance dipertahankan.
 */
export function chunkText(
  normalized: string,
  pages: Map<number, number>,
): Chunk[] {
  const lines =
    normalized.split("\n");

  const chunks: Chunk[] = [];

  let currentPage = 1;

  let section: Section =
    "pembukaan";

  let bab: string | null = null;
  let babTitle: string | null = null;

  let bagian: string | null = null;

  let pasal: string | null = null;
  let pasalNumber: number | null = null;

  let currentAyatNumber:
    number | null = null;

  let currentAngka: number | null = null;

  let currentText: string[] = [];

  let chunkPageStart:
    number | null = null;

  let chunkPageEnd:
    number | null = null;

  let explanationMode = false;

  /**
   * Simpan current chunk.
   */
  const flushChunk = () => {
    if (
      currentText.length === 0
    ) {
      return;
    }

    const text =
      currentText
        .join("\n")
        .trim();

    if (!text) {
      currentText = [];
      return;
    }

    const context: ChunkContext =
      {
        section,

        bab,

        bab_title:
          babTitle,

        bagian,

        pasal,

        pasal_number:
          pasalNumber,

        ayat:
          currentAyatNumber !== null
            ? `(${currentAyatNumber})`
            : null,

        ayat_number:
          currentAyatNumber,

        angka:
          currentAngka,

        page_start:
          chunkPageStart,

        page_end:
          chunkPageEnd,
      };

    chunks.push(
      createChunk(
        context,
        text,
      ),
    );

    currentText = [];
    chunkPageStart = null;
    chunkPageEnd = null;
  };

  /**
   * Tambahkan text ke current chunk.
   */
  const addText = (
    text: string,
    page: number,
  ) => {
    const clean =
      text.trim();

    if (!clean) {
      return;
    }

    if (
      chunkPageStart === null
    ) {
      chunkPageStart = page;
    }

    chunkPageEnd = page;

    currentText.push(clean);
  };

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const rawLine =
      lines[i];

    const line =
      rawLine.trim();

    if (!line) {
      continue;
    }

    /* -----------------------------------------
     * PAGE
     * ----------------------------------------- */

    const detectedPage =
      detectPage(line);

    if (
      detectedPage !== null
    ) {
      currentPage =
        detectedPage;
      continue;
    }

    /*
     * Jika mapping pages tersedia,
     * gunakan mapping tersebut.
     */
    const mappedPage =
      pages.get(i);

    if (
      mappedPage !== undefined
    ) {
      currentPage =
        mappedPage;
    }

    /* -----------------------------------------
     * PENJELASAN
     * ----------------------------------------- */

    if (
      /^PENJELASAN$/i.test(
        line,
      )
    ) {
      flushChunk();

      section =
        "penjelasan";

      explanationMode = true;

      bab = null;
      babTitle = null;
      bagian = null;
      pasal = null;
      pasalNumber = null;

      currentAyatNumber =
        null;

      currentAngka = null;

      continue;
    }

    /*
     * Dalam penjelasan, "II. PASAL DEMI PASAL"
     * adalah struktur, bukan text chunk.
     */
    if (
      explanationMode &&
      isPasalDemiPasal(line)
    ) {
      flushChunk();

      section =
        "penjelasan";

      pasal = null;
      pasalNumber = null;

      currentAyatNumber =
        null;

      currentAngka = null;

      continue;
    }

    /* -----------------------------------------
     * BAB
     * ----------------------------------------- */

    const detectedBab =
      detectBab(
        cleanHeading(line),
      );

    if (
      detectedBab !== null
    ) {
      flushChunk();

      section =
        explanationMode
          ? "penjelasan"
          : "batang_tubuh";

      bab =
        detectedBab;

      /*
       * Judul BAB sering berada pada baris
       * berikutnya dan dapat terpisah dari
       * heading BAB.
       *
       * Judul akan ditangkap oleh logic
       * continuation di bawah.
       */

      babTitle = null;

      bagian = null;

      pasal = null;
      pasalNumber = null;

      currentAyatNumber =
        null;

      currentAngka = null;

      continue;
    }

    /* -----------------------------------------
     * BAGIAN
     * ----------------------------------------- */

    const detectedBagian =
      detectBagian(
        cleanHeading(line),
      );

    if (
      detectedBagian !== null
    ) {
      flushChunk();

      bagian =
        detectedBagian;

      /*
       * Judul Bagian dapat berada di baris
       * berikutnya sebagai plain text.
       *
       * Tidak dimasukkan ke text chunk.
       * Disimpan sebagai metadata.
       */

      continue;
    }

    /* -----------------------------------------
     * PASAL
     * ----------------------------------------- */

    const pasalInfo =
      detectPasal(
        cleanHeading(line),
      );

    if (
      pasalInfo !== null
    ) {
      flushChunk();

      pasal =
        pasalInfo.pasal;

      pasalNumber =
        pasalInfo.pasal_number;

      currentAyatNumber =
        null;

      currentAngka = null;

      /*
       * Untuk penjelasan:
       *
       * satu Pasal = satu chunk.
       *
       * Untuk batang tubuh:
       * chunk dibuat berdasarkan Ayat
       * atau fallback seluruh Pasal.
       */

      continue;
    }

    /* -----------------------------------------
     * JUDUL BAGIAN / BAB CONTINUATION
     * ----------------------------------------- */

    if (
      (bab !== null ||
        bagian !== null) &&
      pasal === null &&
      /^[A-Z0-9][A-Z0-9\s.,'’"()\/:-]+$/.test(
        cleanHeading(line),
      )
    ) {
      const title =
        cleanHeading(line);

      if (
        bagian !== null
      ) {
        bagian =
          `${bagian}: ${title}`;
      } else if (
        bab !== null
      ) {
        babTitle =
          title;
      }

      continue;
    }

    /* -----------------------------------------
     * PASAL 1 – ANGKA DEFINISI
     * ----------------------------------------- */

    if (
      section === "batang_tubuh" &&
      pasalNumber === 1 &&
      currentAyatNumber === null
    ) {
      const angka =
        detectAngkaPasal1(line);

      if (
        angka !== null
      ) {
        flushChunk();

        currentAngka =
          angka;

        addText(
          line,
          currentPage,
        );

        continue;
      }
    }

    /* -----------------------------------------
     * AYAT
     * ----------------------------------------- */

    const ayatNumber =
      detectAyat(line);

    if (
      ayatNumber !== null
    ) {
      /*
       * Untuk penjelasan, ayat tidak
       * menjadi chunk terpisah.
       */
      if (
        section ===
        "penjelasan"
      ) {
        addText(
          line,
          currentPage,
        );

        continue;
      }

      /*
       * Batang tubuh:
       * setiap ayat menjadi chunk.
       */
      flushChunk();

      currentAngka =
        null;

      currentAyatNumber =
        ayatNumber;

      addText(
        line,
        currentPage,
      );

      continue;
    }

    /* -----------------------------------------
     * HURUF
     * ----------------------------------------- */

    if (
      isHuruf(line)
    ) {
      /*
       * Huruf TIDAK menjadi chunk baru.
       *
       * Contoh:
       * a. ...
       * b. ...
       * c. ...
       *
       * semuanya tetap berada dalam
       * chunk Ayat yang sama.
       */
      addText(
        line,
        currentPage,
      );

      continue;
    }

    /* -----------------------------------------
     * CONTENT
     * ----------------------------------------- */

    /*
     * Pembukaan/pengesahan/penjelasan:
     * konten ditambahkan sesuai konteks.
     */
    addText(
      line,
      currentPage,
    );
  }

  flushChunk();

  /*
   * Setelah parsing selesai, tandai section
   * pembukaan/pengesahan berdasarkan posisi
   * tidak diperlakukan sebagai Pasal.
   *
   * Untuk MVP frozen dataset, pembukaan dan
   * pengesahan masing-masing hanya satu chunk.
   */

  return chunks;
}

/* =========================================================
 * FALLBACK
 * ========================================================= */

/**
 * Fallback apabila suatu Pasal tidak mempunyai Ayat.
 *
 * Seluruh isi Pasal menjadi satu chunk.
 */
export function fallbackToPasal(
  pasalNumber: number,
  text: string,
  pageStart: number,
  pageEnd: number,
  bab: string | null = null,
  babTitle: string | null = null,
  bagian: string | null = null,
): Chunk {
  return {
    chunk_id:
      `${DOCUMENT_ID}-batang-tubuh-pasal-${pasalNumber}`,

    document_id:
      DOCUMENT_ID,

    document_title:
      DOCUMENT_TITLE,

    section:
      "batang_tubuh",

    bab,

    bab_title:
      babTitle,

    bagian,

    pasal:
      `Pasal ${pasalNumber}`,

    pasal_number:
      pasalNumber,

    ayat:
      null,

    ayat_number:
      null,

    angka:
      null,

    page_start:
      pageStart,

    page_end:
      pageEnd,

    text:
      text.trim(),
  };
}

/* =========================================================
 * VALIDATION
 * ========================================================= */

/**
 * Normalisasi whitespace untuk kebutuhan
 * validasi multiset.
 *
 * Ini TIDAK mengubah text yang disimpan.
 */
function normalizeForValidation(
  text: string,
): string {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validasi no-text-loss.
 *
 * Prinsip:
 *
 * Semua substantive text yang masuk ke chunk
 * harus dapat ditemukan kembali.
 *
 * Metadata / structural heading tidak dihitung
 * sebagai kehilangan text karena memang sengaja
 * dipindahkan menjadi metadata.
 */
export function validateChunks(
  inputText: string,
  chunks: Chunk[],
): {
  valid: boolean;
  missingTextLines: string[];
  extraTextLines: string[];
} {
  const inputLines =
    inputText
      .split("\n")
      .map(normalizeForValidation)
      .filter(Boolean);

  const outputLines =
    chunks
      .flatMap((chunk) =>
        chunk.text.split("\n"),
      )
      .map(normalizeForValidation)
      .filter(Boolean);

  const inputCounts =
    new Map<string, number>();

  const outputCounts =
    new Map<string, number>();

  for (const line of inputLines) {
    inputCounts.set(
      line,
      (inputCounts.get(line) ?? 0) +
        1,
    );
  }

  for (const line of outputLines) {
    outputCounts.set(
      line,
      (outputCounts.get(line) ?? 0) +
        1,
    );
  }

  const missingTextLines: string[] =
    [];

  const extraTextLines: string[] =
    [];

  for (
    const [line, count] of inputCounts
  ) {
    const outputCount =
      outputCounts.get(line) ?? 0;

    if (
      outputCount < count
    ) {
      for (
        let i = outputCount;
        i < count;
        i++
      ) {
        missingTextLines.push(
          line,
        );
      }
    }
  }

  for (
    const [line, count] of outputCounts
  ) {
    const inputCount =
      inputCounts.get(line) ?? 0;

    if (
      inputCount < count
    ) {
      for (
        let i = inputCount;
        i < count;
        i++
      ) {
        extraTextLines.push(
          line,
        );
      }
    }
  }

  return {
    valid:
      missingTextLines.length === 0 &&
      extraTextLines.length === 0,

    missingTextLines,
    extraTextLines,
  };
}