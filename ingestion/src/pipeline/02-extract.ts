import "dotenv/config";

import fs from "fs";
import path from "path";

import LlamaCloud from "@llamaindex/llama-cloud";

import {
  config,
  getLlamaCloudApiKey,
} from "../utils/config.js";
import {
  loadManifest,
  readSources,
  saveManifest,
  sha256File,
} from "../utils/manifest.js";

import type {
  ManifestEntry,
  ParseOptions,
} from "../utils/types.js";

const RAW_DIR = path.resolve(config.data.raw);
const EXTRACTED_DIR = path.resolve(
  config.data.extracted,
);

const DEFAULT_PARSE: ParseOptions = {
  tier: "agentic",
  version: "latest",
};

async function main(): Promise<void> {
  const sources = readSources();
  const manifest = loadManifest(
    sources.corpus_version,
  );

  fs.mkdirSync(EXTRACTED_DIR, {
    recursive: true,
  });

  const client = new LlamaCloud({
    apiKey: getLlamaCloudApiKey(),
  });

  const defaults =
    sources.parse_defaults ?? DEFAULT_PARSE;

  const enabled = sources.documents.filter(
    (doc) => doc.enabled !== false,
  );

  console.log(
    `[extract] ${enabled.length} dokumen aktif`,
  );

  let failures = 0;

  for (const doc of enabled) {
    console.log(
      `\n[${doc.document_id}] ${doc.doc_title}`,
    );

    const pdfPath = path.join(
      RAW_DIR,
      `${doc.document_id}.pdf`,
    );

    if (!fs.existsSync(pdfPath)) {
      console.error(
        `  PDF tidak ditemukan: ${pdfPath}\n` +
          '  → jalankan "npm run fetch" lebih dulu.',
      );

      failures++;
      continue;
    }

    const pdfSha = await sha256File(pdfPath);

    const mdPath = path.join(
      EXTRACTED_DIR,
      `${doc.document_id}.md`,
    );

    const jsonPath = path.join(
      EXTRACTED_DIR,
      `${doc.document_id}.parse-result.json`,
    );

    const existing =
      manifest.documents[doc.document_id];

    if (
      fs.existsSync(mdPath) &&
      existing?.extracted_sha256 === pdfSha
    ) {
      console.log(
        "  skip: hasil parse sudah ada & checksum cocok",
      );
      continue;
    }

    const parse = doc.parse ?? defaults;

    console.log(
      `  parse (tier=${parse.tier}, version=${parse.version})`,
    );

    try {
      const file = await client.files.create({
        file: fs.createReadStream(pdfPath),
        purpose: "parse",
      });

      const result = await client.parsing.parse({
        file_id: file.id,
        tier: parse.tier as "agentic",
        version: parse.version,
        expand: ["markdown"],
      });

      const markdown = extractMarkdown(result);

      fs.writeFileSync(
        jsonPath,
        JSON.stringify(result, null, 2),
        "utf-8",
      );

      fs.writeFileSync(mdPath, markdown, "utf-8");

      const entry: ManifestEntry =
        existing ?? {
          document_id: doc.document_id,
          source_url: doc.source_url,
          status: "verified",
          retrieved_at: null,
          bytes: fs.statSync(pdfPath).size,
          sha256: pdfSha,
        };

      manifest.documents[doc.document_id] = {
        ...entry,
        extracted_at: new Date().toISOString(),
        extracted_sha256: pdfSha,
      };

      console.log(
        `  OK halaman=${countPages(markdown)}, ${markdown.length} karakter`,
      );
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
    console.error(
      `\nGagal: ${failures} dokumen.`,
    );
    process.exit(1);
  }

  console.log("\nSTEP 2 (extract) : PASS");
}

function extractMarkdown(result: unknown): string {
  const value = result as {
    markdown?: string;
    pages?: Array<{
      markdown?: string;
    }>;
    result?: {
      markdown?: string;
      pages?: Array<{
        markdown?: string;
      }>;
    };
  };

  if (typeof value.markdown === "string") {
    return value.markdown;
  }

  if (Array.isArray(value.pages)) {
    return value.pages
      .map((page) => page.markdown ?? "")
      .join("\n");
  }

  if (
    value.result &&
    typeof value.result.markdown === "string"
  ) {
    return value.result.markdown;
  }

  if (
    value.result &&
    Array.isArray(value.result.pages)
  ) {
    return value.result.pages
      .map((page) => page.markdown ?? "")
      .join("\n");
  }

  throw new Error(
    "Markdown hasil parsing tidak ditemukan pada response LlamaCloud.",
  );
}

/**
 * Marker halaman dari LlamaParse berbentuk:
 * "--- Halaman 1 ---"
 */
function countPages(markdown: string): number {
  const matches = markdown.match(
    /^---\s*Halaman\s+\d+\s*---$/gim,
  );

  return matches?.length ?? 0;
}

main().catch((error) => {
  console.error("Gagal:", error);
  process.exit(1);
});
