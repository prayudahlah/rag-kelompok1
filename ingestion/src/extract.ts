import "dotenv/config";

import fs from "fs";
import path from "path";

import LlamaCloud from "@llamaindex/llama-cloud";

import { config } from "./config.js";

const INPUT_PATH = path.resolve(
  config.data.raw,
  "uu27-2022.pdf",
);

const OUTPUT_DIR = path.resolve(
  config.data.extracted,
);

const JSON_OUTPUT_PATH = path.resolve(
  OUTPUT_DIR,
  "uu27-2022.parse-result.json",
);

const MARKDOWN_OUTPUT_PATH = path.resolve(
  OUTPUT_DIR,
  "uu27-2022.md",
);

async function main(): Promise<void> {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(
      `PDF tidak ditemukan: ${INPUT_PATH}`,
    );
  }

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true,
  });

  const client = new LlamaCloud({
    apiKey: config.llamaCloudApiKey,
  });

  console.log("Uploading PDF...");

  const file = await client.files.create({
    file: fs.createReadStream(INPUT_PATH),
    purpose: "parse",
  });

  console.log(
    `Uploaded. file_id: ${file.id}`,
  );

  console.log(
    "Parsing (tier=agentic, version=latest)...",
  );

  const result = await client.parsing.parse({
  file_id: file.id,
  tier: "agentic",
  version: "latest",
  expand: ["markdown"],
});

const markdown = extractMarkdown(result);

  fs.writeFileSync(
    JSON_OUTPUT_PATH,
    JSON.stringify(result, null, 2),
    "utf-8",
  );

  fs.writeFileSync(
    MARKDOWN_OUTPUT_PATH,
    markdown,
    "utf-8",
  );

  console.log(
    `Jumlah halaman: ${countPages(markdown)}`,
  );

  console.log(
    `Panjang markdown: ${markdown.length} karakter`,
  );

  console.log(
    `JSON disimpan: ${JSON_OUTPUT_PATH}`,
  );

  console.log(
    `Markdown disimpan: ${MARKDOWN_OUTPUT_PATH}`,
  );

  console.log("STEP 5 : PASS");
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

  if (
    typeof value.markdown === "string"
  ) {
    return value.markdown;
  }

  if (
    Array.isArray(value.pages)
  ) {
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

function countPages(markdown: string): number {
  const matches = markdown.match(
    /<!--\s*Page\s+\d+\s*-->/gi,
  );

  return matches?.length ?? 0;
}

main().catch((error) => {
  console.error("Gagal:", error);
  process.exit(1);
});