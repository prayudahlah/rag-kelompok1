# Evaluasi RAG PDP

Harness evaluasi untuk mengukur kualitas **retrieval** dan **jawaban** RAG,
serta menghasilkan chart **SVG**.

## Menjalankan

Prasyarat: server sedang berjalan (`npm run dev -w server`) dan korpus
(`ingestion/data/lancedb`) tersedia.

```
npm run run -w eval                       # semua mode + chat
npm run run -w eval -- --judge            # tambah penilaian LLM (faithfulness/correctness)
npm run run -w eval -- --judge --judge-limit 8   # batasi jumlah item yang dinilai LLM
npm run run -w eval -- --modes hybrid     # hanya satu mode
npm run run -w eval -- --skip-chat        # hanya metrik retrieval
npm run run -w eval -- --skip-retrieval   # hanya chat + metrik jawaban
npm run run -w eval -- --charts-only     # regenerate chart + report dari hasil tersimpan (tanpa API)
npm run run -w eval -- --label v2         # label run
npm run run -w eval -- --delay 500        # jeda antar request (ms), default 300
```

Env (opsional):
- `SERVER_URL` (default `http://localhost:3000`)
- `EVAL_K` (default `8`)
- `EVAL_JUDGE_MODEL` (default `gemini-3.1-flash-lite`)
- `GEMINI_API_KEY` (untuk judge; otomatis dibaca dari `server/.env` atau
  `ingestion/.env` bila tidak diset)

## Dataset - `golden.jsonl`

Satu JSON per baris:

```json
{
  "id": "q01",
  "category": "definisi",
  "question": "Apa yang dimaksud dengan Data Pribadi?",
  "expected_document_id": "uu-27-2022",
  "expected_chunk_ids": ["uu-27-2022:batang-tubuh:pasal-1:angka-1"],
  "reference_answer": "...",
  "history": [ ... ],        // opsional, untuk multi-turn
  "should_abstain": true     // opsional, untuk kasus di luar korpus
}
```

## Metrik

Retrieval (per mode: hybrid/vector/fts): Recall@1/3/5/8, MRR, nDCG@5, per kategori.

Jawaban: citation coverage, abstain accuracy, faithfulness & correctness
(bila `--judge`), latensi rata-rata, fallback rate.

## Output

- `results/<run_id>.json` - metrik agregat + konfigurasi run (tidak di-commit).
- `results/<run_id>.items.jsonl` - detail per pertanyaan (tidak di-commit).
- `reports/report.md` - ringkasan lintas-run (di-commit).
- `reports/charts/*.svg` - chart (di-commit).
