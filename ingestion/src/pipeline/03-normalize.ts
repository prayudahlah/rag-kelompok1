import fs from "fs";
import path from "path";

const INPUT_PATH = path.resolve(
  "data/extracted/uu27-2022.md",
);

const OUTPUT_PATH = path.resolve(
  "data/normalized/uu27-2022.normalized.md",
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
    if (
      /^\[signature:/i.test(line)
    ) {
      continue;
    }

    // 5. Remove standalone page-number artifacts
    //    Example: "- 12 -"
    if (
      /^-\s*\d+\s*-$/.test(line)
    ) {
      continue;
    }

    // 6. Remove split running header:
    //    PRESIDEN
    //    REPUBLIK INDONESIA
    //
    //    Hanya dianggap running header jika
    //    kedua baris berdampingan.
    if (
      /^PRESIDEN$/i.test(line) &&
      i + 1 < lines.length &&
      /^REPUBLIK INDONESIA$/i.test(
        lines[i + 1].trim(),
      )
    ) {
      // Pertahankan pasangan pertama jika belum
      // pernah menemukan header substantif.
      if (!seenSubstantivePresiden) {
        output.push("PRESIDEN");
        output.push("REPUBLIK INDONESIA");

        seenSubstantivePresiden = true;
      }

      i++;
      continue;
    }

    // 7. Running header:
    //    PRESIDEN REPUBLIK INDONESIA
    //
    //    Pertahankan kemunculan substantif pertama.
    //    Kemunculan berikutnya dianggap running header.
    if (
      /^PRESIDEN REPUBLIK INDONESIA$/i.test(line)
    ) {
      if (!seenSubstantivePresiden) {
        output.push(line);
        seenSubstantivePresiden = true;
      }

      continue;
    }

    // 8. Remove blockquote artifact.
    //    Hanya marker ">"-nya, bukan isi hukumnya.
    if (line.startsWith(">")) {
      output.push(
        line.replace(/^>\s?/, ""),
      );
      continue;
    }

    // 9. Remove bullet artifact "* a."
    //
    //    Hanya marker layout, bukan isi setelahnya.
    const bulletMatch = line.match(
      /^\*\s+([a-z])\.\s*(.*)$/i,
    );

    if (bulletMatch) {
      output.push(
        `${bulletMatch[1]}. ${bulletMatch[2]}`,
      );
      continue;
    }

    // 10. Conservative continuation marker.
    //
    // Jangan menghapus ". . ." secara global.
    // Hanya tangani jika baris berikutnya merupakan
    // continuation dari teks yang sama.
    if (
      endsWithContinuationMarker(line) &&
      i + 1 < lines.length
    ) {
      const nextLine = lines[i + 1].trim();

      if (
        nextLine !== "" &&
        looksLikeContinuation(
          line,
          nextLine,
        )
      ) {
        output.push(
          removeContinuationMarker(line),
        );
        continue;
      }
    }

    // 11. Preserve everything else exactly.
    output.push(original);
  }

  // 12. Collapse excessive blank lines.
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
  // Continuation layout pada dokumen ini biasanya
  // terjadi ketika teks terpotong di akhir halaman.
  //
  // Kita tidak mencoba memperbaiki OCR atau
  // menggabungkan kalimat secara agresif.

  if (
    /^(BAB|Pasal|PENJELASAN|##|###|####)/i.test(
      next,
    )
  ) {
    return false;
  }

  return current.length > 0 && next.length > 0;
}

function main(): void {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(
      `Input tidak ditemukan: ${INPUT_PATH}`,
    );
  }

  fs.mkdirSync(
    path.dirname(OUTPUT_PATH),
    { recursive: true },
  );

  const raw = fs.readFileSync(
    INPUT_PATH,
    "utf-8",
  );

  const normalized = normalize(raw);

  fs.writeFileSync(
    OUTPUT_PATH,
    normalized,
    "utf-8",
  );

  console.log(
    `Input : ${INPUT_PATH}`,
  );

  console.log(
    `Output: ${OUTPUT_PATH}`,
  );

  console.log(
    `Panjang hasil: ${normalized.length} karakter`,
  );

  console.log(
    "STEP 6 : PASS",
  );
}

main();