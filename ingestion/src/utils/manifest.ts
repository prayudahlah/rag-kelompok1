import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { config } from "./config.js";

import type {
  CorpusManifest,
  CorpusSources,
} from "./types.js";

/**
 * Membaca daftar dokumen sumber (yang dikurasi manual).
 */
export function readSources(): CorpusSources {
  const sourcePath = path.resolve(config.corpus.sources);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `sources.json tidak ditemukan: ${sourcePath}`,
    );
  }

  return JSON.parse(
    fs.readFileSync(sourcePath, "utf-8"),
  ) as CorpusSources;
}

/**
 * Membaca manifest hasil unduhan. Jika belum ada,
 * mengembalikan manifest kosong.
 */
export function loadManifest(
  corpusVersion: string,
): CorpusManifest {
  const manifestPath = path.resolve(config.corpus.manifest);

  if (!fs.existsSync(manifestPath)) {
    return {
      corpus_version: corpusVersion,
      generated_at: null,
      documents: {},
    };
  }

  return JSON.parse(
    fs.readFileSync(manifestPath, "utf-8"),
  ) as CorpusManifest;
}

/**
 * Menulis manifest ke disk.
 */
export function saveManifest(
  manifest: CorpusManifest,
): void {
  const manifestPath = path.resolve(config.corpus.manifest);

  fs.mkdirSync(path.dirname(manifestPath), {
    recursive: true,
  });

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}

/**
 * Menghitung SHA-256 sebuah file (streaming, aman untuk file besar).
 */
export function sha256File(
  filePath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () =>
      resolve(hash.digest("hex")),
    );
  });
}
