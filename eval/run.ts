import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GoogleGenAI } from "@google/genai";
import * as vega from "vega";
import { compile } from "vega-lite";
import type { TopLevelSpec } from "vega-lite";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const TOP_K = Number(process.env.EVAL_K ?? 8);
const K_LIST = [1, 3, 5, 8].filter((k) => k <= TOP_K);

const ALL_MODES = ["hybrid", "vector", "fts"] as const;
type Mode = (typeof ALL_MODES)[number];

const RESULTS_DIR = path.join(HERE, "results");
const REPORTS_DIR = path.join(HERE, "reports");
const CHARTS_DIR = path.join(REPORTS_DIR, "charts");
const GOLDEN_PATH = path.join(HERE, "golden.jsonl");

interface GoldenMessage {
  role: "user" | "assistant";
  content: string;
}

interface GoldenItem {
  id: string;
  category: string;
  question: string;
  history?: GoldenMessage[];
  expected_chunk_ids?: string[];
  expected_document_id?: string;
  should_abstain?: boolean;
  reference_answer?: string;
}

interface SearchResult {
  chunk_id: string;
  document_id: string;
  context_header: string | null;
  text: string;
  distance: number | null;
}

interface SearchResponse {
  mode: string;
  usedFallback: boolean;
  notice: string | null;
  results: SearchResult[];
}

interface Citation {
  marker: string;
  chunk_id: string;
  label: string;
}

interface ChatResponse {
  answer: string;
  citations: Citation[];
  sources: SearchResult[];
  mode: string;
  usedFallback: boolean;
  notice: string | null;
  retrieval_query: string;
}

interface JudgeScore {
  faithfulness: number;
  correctness: number;
}

interface RunConfig {
  modes: Mode[];
  k: number;
  judge: boolean;
  judgeModel: string;
  serverUrl: string;
  goldenSha256: string;
}

interface RetrievalAgg {
  count: number;
  recall: Record<string, number>;
  mrr: number;
  ndcg5: number;
}

interface RunResult {
  run_id: string;
  timestamp: string;
  label: string;
  config: RunConfig;
  retrieval: Record<string, RetrievalAgg & { perCategory: Record<string, number> }>;
  answer: {
    count: number;
    citationCoverage: number;
    abstainAccuracy: number;
    faithfulness: number | null;
    correctness: number | null;
    avgLatencyMs: number;
    fallbackRate: number;
  };
}

/* ----------------------------- helpers ----------------------------- */

function parseArgs(argv: string[]): {
  modes: Mode[];
  label: string;
  judge: boolean;
  judgeLimit: number;
  skipChat: boolean;
  skipRetrieval: boolean;
  chartsOnly: boolean;
  delayMs: number;
} {
  let modes: Mode[] = [...ALL_MODES];
  let label = "baseline";
  let judge = false;
  let judgeLimit = 8;
  let skipChat = false;
  let skipRetrieval = false;
  let chartsOnly = false;
  let delayMs = 300;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--modes") {
      modes = (argv[++i] ?? "").split(",").map((m) => m.trim()) as Mode[];
    } else if (arg.startsWith("--modes=")) {
      modes = arg.slice("--modes=".length).split(",").map((m) => m.trim()) as Mode[];
    } else if (arg === "--label") {
      label = argv[++i] ?? label;
    } else if (arg.startsWith("--label=")) {
      label = arg.slice("--label=".length);
    } else if (arg === "--judge") {
      judge = true;
    } else if (arg === "--judge-limit") {
      judgeLimit = Number(argv[++i] ?? judgeLimit);
    } else if (arg.startsWith("--judge-limit=")) {
      judgeLimit = Number(arg.slice("--judge-limit=".length));
    } else if (arg === "--skip-chat") {
      skipChat = true;
    } else if (arg === "--skip-retrieval") {
      skipRetrieval = true;
    } else if (arg === "--charts-only") {
      chartsOnly = true;
    } else if (arg === "--delay") {
      delayMs = Number(argv[++i] ?? delayMs);
    } else if (arg.startsWith("--delay=")) {
      delayMs = Number(arg.slice("--delay=".length));
    }
  }

  return { modes, label, judge, judgeLimit, skipChat, skipRetrieval, chartsOnly, delayMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson<T>(
  url: string,
  body: unknown,
  retries = 4,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    let message = `HTTP ${res.status}`;
    let retryMs: number | undefined;

    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) message = errBody.error.message;

      const m = String(message).match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
      if (m) retryMs = Math.ceil(Number(m[1]) * 1000);
    } catch {
      // bukan JSON
    }

    lastError = new Error(message);

    const transient = res.status === 429 || res.status >= 500;

    if (!transient || attempt === retries) {
      break;
    }

    const waitMs = (retryMs ?? Math.min(40000, 1000 * 2 ** attempt)) + 500;
    console.warn(`  retry ${attempt + 1}/${retries} (HTTP ${res.status}) dalam ${waitMs}ms`);
    await sleep(waitMs);
  }

  throw lastError instanceof Error ? lastError : new Error("request gagal");
}

function loadGolden(): GoldenItem[] {
  return fs
    .readFileSync(GOLDEN_PATH, "utf-8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as GoldenItem);
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function loadKeyFromEnvFiles(): void {
  if (process.env.GEMINI_API_KEY) return;

  for (const rel of ["../server/.env", "../ingestion/.env"]) {
    const p = path.join(HERE, rel);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/);
      if (m && m[1].trim() !== "") {
        process.env.GEMINI_API_KEY = m[1].trim();
        return;
      }
    }
  }
}

function pasalPrefix(chunkId: string): string {
  return chunkId.replace(/:(ayat|angka)-\d+$/, "");
}

function recallAtK(results: SearchResult[], expected: Set<string>, k: number): number {
  return results.slice(0, k).some((r) => expected.has(r.chunk_id)) ? 1 : 0;
}

function reciprocalRank(results: SearchResult[], expected: Set<string>): number {
  const index = results.findIndex((r) => expected.has(r.chunk_id));
  return index === -1 ? 0 : 1 / (index + 1);
}

function ndcgAtK(results: SearchResult[], expected: Set<string>, k: number): number {
  const gains = results.slice(0, k).map((r) => (expected.has(r.chunk_id) ? 1 : 0));
  const dcg = gains.reduce<number>((sum, g, i) => sum + g / Math.log2(i + 2), 0);
  const idealCount = Math.min(expected.size, k);
  const idcg = Array.from({ length: idealCount }).reduce<number>(
    (sum, _g, i) => sum + 1 / Math.log2(i + 2),
    0,
  );
  return idcg === 0 ? 0 : dcg / idcg;
}

async function searchApi(question: string, mode: Mode, k: number): Promise<SearchResponse> {
  return postJson<SearchResponse>(`${SERVER_URL}/api/search`, {
    query: question,
    k,
    mode,
  });
}

async function chatApi(item: GoldenItem): Promise<{ data: ChatResponse; latencyMs: number }> {
  const messages = [...(item.history ?? []), { role: "user" as const, content: item.question }];
  const started = Date.now();
  const data = await postJson<ChatResponse>(`${SERVER_URL}/api/chat`, {
    messages,
    k: TOP_K,
    mode: "hybrid",
  });
  return { data, latencyMs: Date.now() - started };
}

/* ------------------------------- judge ------------------------------ */

let judgeClient: GoogleGenAI | null = null;

async function judgeAnswer(
  item: GoldenItem,
  data: ChatResponse,
  judgeModel: string,
): Promise<JudgeScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  if (!judgeClient) judgeClient = new GoogleGenAI({ apiKey });

  const sources = data.sources
    .map((s, i) => `[S${i + 1}] ${s.context_header ?? s.chunk_id}\n${s.text}`)
    .join("\n\n");

  const prompt = [
    "Nilai jawaban asisten berdasarkan SUMBER dan (bila ada) JAWABAN REFERENSI.",
    "Keluarkan HANYA JSON: {\"faithfulness\": <0..1>, \"correctness\": <0..1>}",
    "faithfulness: apakah semua klaim didukung SUMBER (1) atau ada halusinasi (0).",
    "correctness: seberapa tepat jawaban vs pertanyaan/referensi (0..1).",
    "",
    "PERTANYAAN:",
    item.question,
    "",
    item.reference_answer ? `JAWABAN REFERENSI:\n${item.reference_answer}\n` : "",
    "SUMBER:",
    sources || "(tidak ada)",
    "",
    "JAWABAN ASISTEN:",
    data.answer,
  ].join("\n");

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const response = await judgeClient.models.generateContent({
        model: judgeModel,
        contents: prompt,
        config: { systemInstruction: "Anda penilai evaluasi RAG yang objektif.", temperature: 0 },
      });
      const text = (response.text ?? "").trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]) as { faithfulness?: number; correctness?: number };
      return {
        faithfulness: Number(parsed.faithfulness ?? 0),
        correctness: Number(parsed.correctness ?? 0),
      };
    } catch (error) {
      const msg = (error as Error).message ?? "";

      if (attempt < 3 && /429|RESOURCE_EXHAUSTED|quota|overloaded|5\d\d/i.test(msg)) {
        await sleep(2000 * 2 ** attempt);
        continue;
      }

      return null;
    }
  }

  return null;
}

/* ------------------------------ charts ------------------------------ */

async function renderSvg(spec: TopLevelSpec, outPath: string): Promise<void> {
  const vgSpec = compile(spec).spec;
  const view = new vega.View(vega.parse(vgSpec), { renderer: "none" });
  const svg = await view.toSVG();
  fs.writeFileSync(outPath, svg, "utf-8");
}

function chartRecallAtK(
  data: Array<{ mode: string; k: number; recall: number }>,
): TopLevelSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 460,
    height: 260,
    title: "Recall@k per mode",
    data: { values: data },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "k", type: "ordinal", title: "k" },
      y: { field: "recall", type: "quantitative", title: "Recall", scale: { domain: [0, 1] } },
      color: { field: "mode", type: "nominal" },
    },
  };
}

function chartMrrNdcg(
  data: Array<{ mode: string; metric: string; value: number }>,
): TopLevelSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 460,
    height: 260,
    title: "MRR & nDCG@5 per mode",
    data: { values: data },
    mark: { type: "bar" },
    encoding: {
      x: { field: "mode", type: "nominal", title: "mode" },
      xOffset: { field: "metric" },
      y: { field: "value", type: "quantitative", scale: { domain: [0, 1] } },
      color: { field: "metric", type: "nominal" },
    },
  };
}

function chartAnswerQuality(
  data: Array<{ metric: string; value: number }>,
): TopLevelSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 460,
    height: 260,
    title: "Kualitas jawaban (run terakhir)",
    data: { values: data },
    mark: { type: "bar" },
    encoding: {
      x: { field: "metric", type: "nominal", title: "metrik", axis: { labelAngle: 0 } },
      y: { field: "value", type: "quantitative", scale: { domain: [0, 1] } },
      color: { field: "metric", type: "nominal" },
    },
  };
}

function chartTrend(
  data: Array<{ run: string; metric: string; value: number }>,
): TopLevelSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 520,
    height: 260,
    title: "Tren metrik antar-run",
    data: { values: data },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "run", type: "ordinal", title: "run" },
      y: { field: "value", type: "quantitative", scale: { domain: [0, 1] } },
      color: { field: "metric", type: "nominal" },
    },
  };
}

function chartPerCategory(
  data: Array<{ category: string; mode: string; recall: number }>,
): TopLevelSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 640,
    height: 320,
    title: "Recall@5 per kategori",
    data: { values: data },
    mark: { type: "bar" },
    encoding: {
      x: {
        field: "category",
        type: "nominal",
        title: "Kategori",
        axis: { labelAngle: -35 },
      },
      xOffset: { field: "mode" },
      y: {
        field: "recall",
        type: "quantitative",
        title: "Recall@5",
        scale: { domain: [0, 1] },
      },
      color: { field: "mode", type: "nominal" },
    },
  };
}

/* --------------------------- charts + report --------------------------- */

function loadRuns(): RunResult[] {
  if (!fs.existsSync(RESULTS_DIR)) return [];

  return fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".partial.json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), "utf-8")) as RunResult)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function latestRetrievalRun(runs: RunResult[]): RunResult | null {
  for (let i = runs.length - 1; i >= 0; i--) {
    if (Object.keys(runs[i].retrieval).length > 0) return runs[i];
  }
  return null;
}

function latestChatRun(runs: RunResult[]): RunResult | null {
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].answer.count > 0) return runs[i];
  }
  return null;
}

async function writeChartsAndReport(
  runs: RunResult[],
  golden: GoldenItem[],
): Promise<void> {
  const ret = latestRetrievalRun(runs);

  if (ret) {
    const recallData: Array<{ mode: string; k: number; recall: number }> = [];
    const mrrData: Array<{ mode: string; metric: string; value: number }> = [];
    const catData: Array<{ category: string; mode: string; recall: number }> = [];

    const totals: Record<string, number> = {};
    for (const g of golden) {
      if (g.expected_chunk_ids && g.expected_chunk_ids.length > 0 && !g.history) {
        totals[g.category] = (totals[g.category] ?? 0) + 1;
      }
    }

    for (const mode of Object.keys(ret.retrieval)) {
      const agg = ret.retrieval[mode];
      const n = agg.count || 1;
      for (const k of K_LIST) recallData.push({ mode, k, recall: agg.recall[k] / n });
      mrrData.push({ mode, metric: "MRR", value: agg.mrr / n });
      mrrData.push({ mode, metric: "nDCG@5", value: agg.ndcg5 / n });

      for (const [category, hits] of Object.entries(agg.perCategory)) {
        const total = totals[category] ?? 0;
        if (total > 0) catData.push({ category, mode, recall: hits / total });
      }
    }

    await renderSvg(chartRecallAtK(recallData), path.join(CHARTS_DIR, "recall-at-k.svg"));
    await renderSvg(chartMrrNdcg(mrrData), path.join(CHARTS_DIR, "mrr-ndcg.svg"));
    await renderSvg(chartPerCategory(catData), path.join(CHARTS_DIR, "per-category.svg"));
  }

  const chat = latestChatRun(runs);

  if (chat) {
    const answerQuality = [
      { metric: "citation_coverage", value: chat.answer.citationCoverage },
      { metric: "abstain_accuracy", value: chat.answer.abstainAccuracy },
    ];
    if (chat.answer.faithfulness !== null)
      answerQuality.push({ metric: "faithfulness", value: chat.answer.faithfulness });
    if (chat.answer.correctness !== null)
      answerQuality.push({ metric: "correctness", value: chat.answer.correctness });
    await renderSvg(chartAnswerQuality(answerQuality), path.join(CHARTS_DIR, "answer-quality.svg"));
  }

  const trendData: Array<{ run: string; metric: string; value: number }> = [];
  for (const run of runs) {
    const hybrid = run.retrieval.hybrid;
    if (hybrid) {
      const n = hybrid.count || 1;
      trendData.push({ run: run.label, metric: "recall@5", value: hybrid.recall[5] / n });
      trendData.push({ run: run.label, metric: "mrr", value: hybrid.mrr / n });
    }
  }
  await renderSvg(chartTrend(trendData), path.join(CHARTS_DIR, "trend.svg"));

  const lines: string[] = [];
  lines.push("# Evaluasi RAG PDP");
  lines.push("");
  lines.push("Dihasilkan otomatis oleh `eval/run.ts`. Chart di `reports/charts/`.");
  lines.push("");
  lines.push("## Ringkasan run");
  lines.push("");
  lines.push("| Run | modes | k | Recall@5 (hybrid) | MRR (hybrid) | Citation cov. | Abstain acc. | Faithfulness | Correctness |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const run of runs) {
    const h = run.retrieval.hybrid;
    const n = h ? h.count || 1 : 1;
    lines.push(
      `| ${run.label} | ${run.config.modes.join(",")} | ${run.config.k} | ${
        h ? (h.recall[5] / n).toFixed(2) : "-"
      } | ${h ? (h.mrr / n).toFixed(2) : "-"} | ${run.answer.citationCoverage.toFixed(2)} | ${run.answer.abstainAccuracy.toFixed(2)} | ${
        run.answer.faithfulness === null ? "-" : run.answer.faithfulness.toFixed(2)
      } | ${run.answer.correctness === null ? "-" : run.answer.correctness.toFixed(2)} |`,
    );
  }
  lines.push("");
  lines.push("## Chart");
  lines.push("");
  lines.push("### Recall@k per mode");
  lines.push("");
  lines.push("![Recall@k](./charts/recall-at-k.svg)");
  lines.push("");
  lines.push("### MRR & nDCG@5 per mode");
  lines.push("");
  lines.push("![MRR nDCG](./charts/mrr-ndcg.svg)");
  lines.push("");
  lines.push("### Recall@5 per kategori");
  lines.push("");
  lines.push("![Per kategori](./charts/per-category.svg)");
  lines.push("");
  lines.push("### Kualitas jawaban");
  lines.push("");
  lines.push("![Answer quality](./charts/answer-quality.svg)");
  lines.push("");
  lines.push("### Tren antar-run");
  lines.push("");
  lines.push("![Trend](./charts/trend.svg)");
  lines.push("");

  fs.writeFileSync(path.join(REPORTS_DIR, "report.md"), lines.join("\n"), "utf-8");
}

/* ------------------------------- main ------------------------------- */

async function main(): Promise<void> {
  const { modes, label, judge, judgeLimit, skipChat, skipRetrieval, chartsOnly, delayMs } = parseArgs(
    process.argv.slice(2),
  );
  loadKeyFromEnvFiles();

  const goldenRaw = fs.readFileSync(GOLDEN_PATH, "utf-8");
  const golden = loadGolden();

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.mkdirSync(CHARTS_DIR, { recursive: true });

  const judgeModel = process.env.EVAL_JUDGE_MODEL ?? "gemini-3.1-flash-lite";
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${label}`;
  const itemsPath = path.join(RESULTS_DIR, `${runId}.items.jsonl`);
  const partialPath = path.join(RESULTS_DIR, `${runId}.partial.json`);

  fs.writeFileSync(itemsPath, "", "utf-8");

  const appendItem = (record: Record<string, unknown>): void => {
    fs.appendFileSync(itemsPath, JSON.stringify(record) + "\n", "utf-8");
  };

  const config: RunConfig = {
    modes,
    k: TOP_K,
    judge,
    judgeModel,
    serverUrl: SERVER_URL,
    goldenSha256: sha256(goldenRaw),
  };

  if (chartsOnly) {
    const existing = loadRuns();
    if (existing.length === 0) {
      console.error("[eval] --charts-only: tidak ada results/*.json.");
      process.exit(1);
    }
    await writeChartsAndReport(existing, golden);
    console.log(`[eval] charts-only selesai (${existing.length} run).`);
    console.log(`  report: ${path.join(REPORTS_DIR, "report.md")}`);
    return;
  }

  const modeResults: Record<string, RetrievalAgg & { perCategory: Record<string, number> }> = {};

  const retrievalItems = golden.filter(
    (g) => g.expected_chunk_ids && g.expected_chunk_ids.length > 0 && !g.history,
  );

  console.log(`[eval] run=${runId}`);
  console.log(
    `[eval] ${golden.length} item, ${retrievalItems.length} retrieval, modes=${modes.join(",")}, delay=${delayMs}ms`,
  );

  for (const mode of (skipRetrieval ? ([] as Mode[]) : modes)) {
    const agg: RetrievalAgg & { perCategory: Record<string, number> } = {
      count: 0,
      recall: Object.fromEntries(K_LIST.map((k) => [k, 0])),
      mrr: 0,
      ndcg5: 0,
      perCategory: {},
    };

    let index = 0;
    for (const item of retrievalItems) {
      index++;
      const expected = new Set(item.expected_chunk_ids ?? []);
      console.log(`  [${mode}] ${index}/${retrievalItems.length} ${item.id}`);
      if (delayMs > 0) await sleep(delayMs);

      let data: SearchResponse;
      try {
        data = await searchApi(item.question, mode, TOP_K);
      } catch (error) {
        appendItem({ id: item.id, mode, error: (error as Error).message });
        continue;
      }

      agg.count++;
      for (const k of K_LIST) agg.recall[k] += recallAtK(data.results, expected, k);
      agg.mrr += reciprocalRank(data.results, expected);
      agg.ndcg5 += ndcgAtK(data.results, expected, 5);

      const cat = item.category;
      const hit = recallAtK(data.results, expected, 5);
      agg.perCategory[cat] = (agg.perCategory[cat] ?? 0) + hit;

      appendItem({
        id: item.id,
        mode,
        category: cat,
        expected: [...expected],
        retrieved: data.results.map((r, i) => ({ rank: i + 1, chunk_id: r.chunk_id })),
        recall3: recallAtK(data.results, expected, 3),
        usedFallback: data.usedFallback,
      });
    }

    modeResults[mode] = agg;
    const n = agg.count || 1;
    console.log(
      `  [${mode}] n=${agg.count} recall@5=${(agg.recall[5] / n).toFixed(2)} mrr=${(agg.mrr / n).toFixed(2)}`,
    );

    fs.writeFileSync(
      partialPath,
      JSON.stringify(
        { run_id: runId, label, config, retrieval: modeResults, answer: null },
        null,
        2,
      ),
      "utf-8",
    );
  }

  // ---- chat / answer ----
  let answerCount = 0;
  let citationCoverage = 0;
  let abstainCorrect = 0;
  let abstainTotal = 0;
  let latencySum = 0;
  let fallbackCount = 0;
  let faithfulnessSum = 0;
  let correctnessSum = 0;
  let judgeCount = 0;

  if (!skipChat) {
    console.log("[eval] chat + answer metrics...");
    let index = 0;
    for (const item of golden) {
      index++;
      console.log(`  [chat] ${index}/${golden.length} ${item.id}`);
      if (delayMs > 0) await sleep(delayMs);

      let data: ChatResponse;
      let latencyMs: number;
      try {
        const out = await chatApi(item);
        data = out.data;
        latencyMs = out.latencyMs;
      } catch (error) {
        appendItem({ id: item.id, mode: "chat", error: (error as Error).message });
        continue;
      }

      answerCount++;
      latencySum += latencyMs;
      if (data.usedFallback) fallbackCount++;

      const hasCitations = /\[S\d+\]/.test(data.answer) || data.citations.length > 0;
      if (hasCitations) citationCoverage++;

      if (item.should_abstain) {
        abstainTotal++;
        const abstained = /tidak ditemukan|tidak ada|maaf/i.test(data.answer);
        if (abstained) abstainCorrect++;
      }

      let score: JudgeScore | null = null;
      if (judge && judgeCount < judgeLimit) {
        console.log(`    judge ${item.id} (${judgeCount + 1}/${judgeLimit})`);
        score = await judgeAnswer(item, data, judgeModel);
        if (score) {
          judgeCount++;
          faithfulnessSum += score.faithfulness;
          correctnessSum += score.correctness;
        }
      }

      appendItem({
        id: item.id,
        mode: "chat",
        category: item.category,
        answer: data.answer,
        citations: data.citations.map((c) => c.marker),
        sources: data.sources.map((s) => ({
          chunk_id: s.chunk_id,
          context_header: s.context_header,
          text: s.text,
        })),
        usedFallback: data.usedFallback,
        retrieval_query: data.retrieval_query,
        latencyMs,
        judge: score,
      });
    }
  }

  const result: RunResult = {
    run_id: runId,
    timestamp: new Date().toISOString(),
    label,
    config,
    retrieval: modeResults,
    answer: {
      count: answerCount,
      citationCoverage: answerCount ? citationCoverage / answerCount : 0,
      abstainAccuracy: abstainTotal ? abstainCorrect / abstainTotal : 0,
      faithfulness: judgeCount ? faithfulnessSum / judgeCount : null,
      correctness: judgeCount ? correctnessSum / judgeCount : null,
      avgLatencyMs: answerCount ? Math.round(latencySum / answerCount) : 0,
      fallbackRate: answerCount ? fallbackCount / answerCount : 0,
    },
  };

  const baseName = runId;
  fs.writeFileSync(path.join(RESULTS_DIR, `${baseName}.json`), JSON.stringify(result, null, 2));
  fs.rmSync(partialPath, { force: true });

  await writeChartsAndReport(loadRuns(), golden);

  console.log(`\n[eval] selesai. run_id=${result.run_id}`);
  console.log(`  results: ${path.join(RESULTS_DIR, baseName + ".json")}`);
  console.log(`  report : ${path.join(REPORTS_DIR, "report.md")}`);
}

main().catch((error) => {
  console.error("Gagal:", error);
  process.exit(1);
});
