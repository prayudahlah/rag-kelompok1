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
const PARSED_DIR = path.resolve(
  config.data.parsed,
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

  fs.mkdirSync(PARSED_DIR, {
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
    `[parse] ${enabled.length} dokumen aktif`,
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
      PARSED_DIR,
      `${doc.document_id}.md`,
    );

    const jsonPath = path.join(
      PARSED_DIR,
      `${doc.document_id}.parse-result.json`,
    );

    const parse = doc.parse ?? defaults;
    const signature = parseSignature(pdfSha, parse);

    const existing =
      manifest.documents[doc.document_id];

    if (
      fs.existsSync(mdPath) &&
      existing?.parse_signature === signature
    ) {
      console.log(
        "  skip: hasil parse sudah ada & signature cocok",
      );
      continue;
    }

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

      const markdown = parseMarkdown(result);

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
        parsed_at: new Date().toISOString(),
        parsed_sha256: pdfSha,
        parse_signature: signature,
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

  console.log("\nSTEP 2 (parse) : PASS");
}

/**
 * Signature parse = gabungan checksum PDF + pengaturan parser.
 * Dipakai untuk memutuskan skip/re-parse: jika salah satu berubah
 * (mis. tier atau version), hasil lama tidak dipakai lagi.
 */
function parseSignature(
  pdfSha: string,
  parse: ParseOptions,
): string {
  return `${pdfSha}:${parse.tier}:${parse.version}`;
}

interface ParsedPage {
  page_number?: number;
  markdown?: string;
  success?: boolean;
}

interface MarkdownPages {
  pages?: ParsedPage[];
}

/**
 * Menggabungkan halaman-halaman markdown menjadi satu string,
 * dengan menyisipkan kembali penanda "--- Halaman N ---" dari
 * `page_number` (penanda ini dibutuhkan tahap chunking untuk
 * provenance halaman).
 */
function joinPages(
  pages: ParsedPage[],
): string | null {
  const usable = pages.filter(
    (page) =>
      page.success !== false &&
      typeof page.markdown === "string",
  );

  if (usable.length === 0) {
    return null;
  }

  return usable
    .map((page, index) => {
      const number =
        typeof page.page_number === "number"
          ? page.page_number
          : index + 1;

      const body = (page.markdown ?? "").trim();

      return `--- Halaman ${number} ---\n\n${body}`;
    })
    .join("\n\n");
}

function parseMarkdown(result: unknown): string {
  const value = result as {
    markdown?: string | MarkdownPages;
    pages?: ParsedPage[];
    result?: {
      markdown?: string | MarkdownPages;
      pages?: ParsedPage[];
    };
  };

  const nested = value.result;

  const candidates: Array<
    string | MarkdownPages | ParsedPage[] | undefined
  > = [
    value.markdown,
    value.pages,
    nested?.markdown,
    nested?.pages,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }

    if (
      candidate &&
      typeof candidate === "object" &&
      "pages" in candidate &&
      Array.isArray(candidate.pages)
    ) {
      const joined = joinPages(candidate.pages);
      if (joined) {
        return joined;
      }
    }

    if (Array.isArray(candidate)) {
      const joined = joinPages(candidate);
      if (joined) {
        return joined;
      }
    }
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
