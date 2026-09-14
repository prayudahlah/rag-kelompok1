import fs from "node:fs";
import path from "node:path";

import { config } from "../utils/config.js";
import { readSources } from "../utils/manifest.js";

const PARSED_DIR = path.resolve(config.data.parsed);
const NORMALIZED_DIR = path.resolve(
  config.data.normalized,
);

function normalize(text: string): string {
  const lines = text.split(/\r?\n/);

  const output: string[] = [];

  let seenSubstantivePresiden = false;

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const line = original.trim();

    // 1. Empty line
    if (line === "") {
      output.push("");
      continue;
    }

    // 2. Remove logo artifacts
    if (/^logo:/i.test(line)) {
      continue;
    }

    // 3. Remove seal artifacts
    if (/^seal:/i.test(line)) {
      continue;
    }

    // 4. Remove signature artifact
    if (/^\[signature:/i.test(line)) {
      continue;
    }

    // 5. Remove standalone page-number artifacts ("- 12 -")
    if (/^-\s*\d+\s*-$/.test(line)) {
      continue;
    }

    // 6. Remove split running header:
    //    PRESIDEN
    //    REPUBLIK INDONESIA
    if (
      /^PRESIDEN$/i.test(line) &&
      i + 1 < lines.length &&
      /^REPUBLIK INDONESIA$/i.test(
        lines[i + 1].trim(),
      )
    ) {
      if (!seenSubstantivePresiden) {
        output.push("PRESIDEN");
        output.push("REPUBLIK INDONESIA");

        seenSubstantivePresiden = true;
      }

      i++;
      continue;
    }

    // 7. Running header (dengan/tanpa prefix heading):
    //    PRESIDEN REPUBLIK INDONESIA
    //    ## PRESIDEN REPUBLIK INDONESIA
    if (
      /^#{0,6}\s*PRESIDEN REPUBLIK INDONESIA$/i.test(
        line,
      )
    ) {
      if (!seenSubstantivePresiden) {
        output.push(original);
        seenSubstantivePresiden = true;
      }

      continue;
    }

    // 8. Remove blockquote marker (bukan isinya)
    if (line.startsWith(">")) {
      output.push(line.replace(/^>\s?/, ""));
      continue;
    }

    // 9. Normalize bullet artifact "* a." -> "a."
    const bulletMatch = line.match(
      /^\*\s+([a-z])\.\s*(.*)$/i,
    );

    if (bulletMatch) {
      output.push(
        `${bulletMatch[1]}. ${bulletMatch[2]}`,
      );
      continue;
    }

    // 10. Continuation marker ". . ."
    if (endsWithContinuationMarker(line)) {
      const truncated = removeContinuationMarker(line);
      const next = findNextContentLine(lines, i + 1);

      if (next !== null) {
        const t = truncated.toLowerCase();
        const n = next.toLowerCase();

        // Jika baris lanjutan mengulang awal yang sama,
        // fragmen terpotong ini adalah artefak page break → buang.
        if (t.length > 0 && n.startsWith(t)) {
          continue;
        }

        if (looksLikeContinuation(line, next)) {
          output.push(truncated);
          continue;
        }
      }
    }

    // 11. Preserve everything else
    output.push(original);
  }

  // 12. Collapse excessive blank lines
  const collapsed: string[] = [];

  let previousBlank = false;

  for (const line of output) {
    const isBlank = line.trim() === "";

    if (isBlank && previousBlank) {
      continue;
    }

    collapsed.push(line);

    previousBlank = isBlank;
  }

  return collapsed.join("\n").trim() + "\n";
}

function endsWithContinuationMarker(
  line: string,
): boolean {
  return /\s\.\s\.\s\.\s*$/.test(line);
}

function isPageMarkerLine(line: string): boolean {
  return /^---\s*Halaman\s+\d+\s*---$/i.test(
    line.trim(),
  );
}

/**
 * Mencari baris konten berikutnya, melewati baris kosong
 * dan penanda halaman.
 */
function findNextContentLine(
  lines: string[],
  start: number,
): string | null {
  for (let j = start; j < lines.length; j++) {
    const candidate = lines[j].trim();

    if (candidate === "" || isPageMarkerLine(candidate)) {
      continue;
    }

    return candidate;
  }

  return null;
}

function removeContinuationMarker(
  line: string,
): string {
  return line
    .replace(/\s\.\s\.\s\.\s*$/, "")
    .trimEnd();
}

function looksLikeContinuation(
  current: string,
  next: string,
): boolean {
  if (
    /^(BAB|Pasal|PENJELASAN|##|###|####)/i.test(next)
  ) {
    return false;
  }

  return current.length > 0 && next.length > 0;
}

function main(): void {
  const sources = readSources();

  const enabled = sources.documents.filter(
    (doc) => doc.enabled !== false,
  );

  fs.mkdirSync(NORMALIZED_DIR, {
    recursive: true,
  });

  console.log(
    `[normalize] ${enabled.length} dokumen aktif`,
  );

  let failures = 0;

  for (const doc of enabled) {
    const inputPath = path.join(
      PARSED_DIR,
      `${doc.document_id}.md`,
    );

    const outputPath = path.join(
      NORMALIZED_DIR,
      `${doc.document_id}.normalized.md`,
    );

    if (!fs.existsSync(inputPath)) {
      console.error(
        `[${doc.document_id}] input tidak ditemukan: ${inputPath}\n` +
          '  → jalankan "npm run parse" lebih dulu.',
      );

      failures++;
      continue;
    }

    const raw = fs.readFileSync(inputPath, "utf-8");
    const normalized = normalize(raw);

    fs.writeFileSync(outputPath, normalized, "utf-8");

    console.log(
      `[${doc.document_id}] ${normalized.length} karakter → ${outputPath}`,
    );
  }

  if (failures > 0) {
    console.error(`\nGagal: ${failures} dokumen.`);
    process.exit(1);
  }

  console.log("\nSTEP 3 (normalize) : PASS");
}

main();
