import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { config } from "../utils/config.js";
import {
  loadManifest,
  readSources,
  saveManifest,
  sha256File,
} from "../utils/manifest.js";

import type {
  ManifestEntry,
  SourceDocument,
} from "../utils/types.js";

const RAW_DIR = path.resolve(config.data.raw);
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;
const MIN_PDF_BYTES = 10_000;

async function downloadPdf(
  url: string,
  target: string,
): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "rag-kelompok1-ingestion/1.0 (+pipeline)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer(),
  );

  const magic = buffer
    .subarray(0, 5)
    .toString("latin1");

  if (!magic.startsWith("%PDF-")) {
    throw new Error(
      `Bukan file PDF (magic="${magic}")`,
    );
  }

  if (buffer.length < MIN_PDF_BYTES) {
    throw new Error(
      `Ukuran terlalu kecil: ${buffer.length} bytes`,
    );
  }

  await fsp.writeFile(target, buffer);
}

async function downloadWithRetry(
  url: string,
  target: string,
): Promise<void> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      await downloadPdf(url, target);
      return;
    } catch (error) {
      lastError = error;

      console.warn(
        `  percobaan ${attempt}/${MAX_ATTEMPTS} gagal: ${
          (error as Error).message
        }`,
      );

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 2000),
        );
      }
    }
  }

  throw lastError;
}

function baseEntry(
  doc: SourceDocument,
): ManifestEntry {
  return {
    document_id: doc.document_id,
    source_url: doc.source_url,
    status: "missing",
    retrieved_at: null,
    bytes: null,
    sha256: null,
  };
}

async function main(): Promise<void> {
  const sources = readSources();
  const manifest = loadManifest(
    sources.corpus_version,
  );

  fs.mkdirSync(RAW_DIR, { recursive: true });

  const enabled = sources.documents.filter(
    (doc) => doc.enabled !== false,
  );

  console.log(
    `[fetch] ${enabled.length} dokumen aktif`,
  );

  let failures = 0;

  for (const doc of enabled) {
    console.log(
      `\n[${doc.document_id}] ${doc.doc_title}`,
    );

    const target = path.join(
      RAW_DIR,
      `${doc.document_id}.pdf`,
    );

    const existing =
      manifest.documents[doc.document_id];

    if (fs.existsSync(target)) {
      const sha = await sha256File(target);

      if (existing?.sha256 === sha) {
        console.log(
          `  skip: file ada & checksum cocok (${sha.slice(0, 12)}…)`,
        );

        manifest.documents[doc.document_id] = {
          ...(existing ?? baseEntry(doc)),
          bytes: fs.statSync(target).size,
          sha256: sha,
          status: "verified",
        };

        continue;
      }

      console.log(
        "  file lokal ada tapi checksum beda/belum tercatat → unduh ulang",
      );
    }

    try {
      console.log(`  mengunduh: ${doc.source_url}`);

      await downloadWithRetry(doc.source_url, target);

      const sha = await sha256File(target);
      const bytes = fs.statSync(target).size;

      manifest.documents[doc.document_id] = {
        ...baseEntry(doc),
        status: "downloaded",
        retrieved_at: new Date().toISOString(),
        bytes,
        sha256: sha,
      };

      console.log(
        `  OK ${bytes} bytes, sha256=${sha.slice(0, 12)}…`,
      );
    } catch (error) {
      failures++;

      console.error(
        `  GAGAL: ${(error as Error).message}`,
      );

      console.error(
        "  → fallback manual: unduh dari URL di atas, " +
          "lalu simpan sebagai " +
          `${path.relative(process.cwd(), target)} ` +
          "dan jalankan ulang.",
      );

      manifest.documents[doc.document_id] = {
        ...baseEntry(doc),
        status: "manual-required",
      };
    }
  }

  manifest.generated_at = new Date().toISOString();
  saveManifest(manifest);

  console.log(
    `\nManifest: ${path.resolve(config.corpus.manifest)}`,
  );

  if (failures > 0) {
    console.error(
      `\nSelesai dengan ${failures} dokumen gagal.`,
    );
    process.exit(1);
  }

  console.log("\nSTEP 1 (fetch) : PASS");
}

main().catch((error) => {
  console.error("Gagal:", error);
  process.exit(1);
});
