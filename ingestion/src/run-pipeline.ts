import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = path.join(SRC_DIR, "pipeline");

interface Step {
  key: string;
  file: string;
}

const STEPS: Step[] = [
  { key: "fetch", file: "01-fetch.ts" },
  { key: "parse", file: "02-parse.ts" },
  { key: "normalize", file: "03-normalize.ts" },
  { key: "chunk", file: "04-chunk.ts" },
  { key: "enrich", file: "05-enrich.ts" },
  { key: "embed", file: "06-embed.ts" },
  { key: "db", file: "07-db.ts" },
];

function parseArgs(argv: string[]): {
  from: string | null;
  skipEmbed: boolean;
  skipDb: boolean;
} {
  let from: string | null = null;
  let skipEmbed = false;
  let skipDb = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--from") {
      from = argv[i + 1] ?? null;
      i++;
    } else if (arg.startsWith("--from=")) {
      from = arg.slice("--from=".length);
    } else if (arg === "--skip-embed") {
      skipEmbed = true;
    } else if (arg === "--skip-db") {
      skipDb = true;
    }
  }

  return { from, skipEmbed, skipDb };
}

function runStep(step: Step): void {
  const script = path.join(PIPELINE_DIR, step.file);

  console.log(`\n========== ${step.key} ==========`);

  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", script],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    console.error(
      `\nTahap "${step.key}" gagal (exit ${result.status ?? "?"}). Berhenti.`,
    );
    process.exit(result.status ?? 1);
  }
}

function main(): void {
  const { from, skipEmbed, skipDb } = parseArgs(
    process.argv.slice(2),
  );

  let steps = STEPS;

  if (skipEmbed) {
    steps = steps.filter((step) => step.key !== "embed");
  }

  if (skipDb) {
    steps = steps.filter((step) => step.key !== "db");
  }

  if (from !== null) {
    const index = steps.findIndex(
      (step) => step.key === from || step.file.startsWith(from),
    );

    if (index === -1) {
      console.error(
        `--from "${from}" tidak dikenal. Pilihan: ${steps
          .map((step) => step.key)
          .join(", ")}.`,
      );
      process.exit(1);
    }

    steps = steps.slice(index);
  }

  console.log(
    `[run-pipeline] tahap: ${steps.map((step) => step.key).join(" -> ")}`,
  );

  for (const step of steps) {
    runStep(step);
  }

  console.log("\n==============================================");
  console.log(" PIPELINE SELESAI");
  console.log("==============================================");
}

main();
