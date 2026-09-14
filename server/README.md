# Server - RAG PDP (Backend)

Backend Express + TypeScript untuk RAG dokumen hukum Pelindungan Data
Pribadi. Berisi dua lapisan:

1. Retrieval - pencarian hybrid (vektor + full-text + RRF) ke tabel LanceDB
   `pdp_corpus` yang dihasilkan `ingestion/`.
2. Generation - jawaban berbahasa Indonesia yang bersitasi, memakai Gemini.

Backend ini membaca tabel LanceDB yang ditulis ingestion (embedded database,
bukan server terpisah). Query embedding memakai Gemini dengan
`taskType = RETRIEVAL_QUERY`.

## Struktur

```
server/
  src/
    index.ts                 # app Express (cors, JSON, /docs, /openapi.json)
    config.ts                # konfigurasi env
    schemas.ts               # skema zod (validasi + OpenAPI)
    openapi.ts               # pembentukan dokumen OpenAPI 3.1
    routes.ts                # /api/search, /api/chat, /api/meta, /api/health
    retrieval/
      search.ts              # hybrid/vector/fts + RRF + filter
      embedQuery.ts          # embedding query (RETRIEVAL_QUERY) + LRU cache
      cache.ts               # LRU sederhana
    generation/
      gemini.ts              # klien Gemini + ekstraksi teks
      prompt.ts              # system instruction + perakitan prompt
      chat.ts                # orkestrasi retrieval + generation
      rewriteQuery.ts        # query rewriting multi-turn
  .env.example
  tsconfig.json
  package.json
```

## Prasyarat

- Sudah menjalankan ingestion sehingga `data/lancedb/pdp_corpus` ada.
- `@rag/shared` sudah di-build: `npm run build -w @rag/shared`.
- `server/.env` (salin dari `server/.env.example`) berisi `GEMINI_API_KEY`.

## Konfigurasi (environment)

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `PORT` | tidak | `3000` | Port HTTP |
| `GEMINI_API_KEY` | ya | - | Embedding query + generation |
| `LANCEDB_PATH` | tidak | `../ingestion/data/lancedb` | Relatif terhadap cwd `server/` |
| `LANCEDB_TABLE` | tidak | `pdp_corpus` | Nama tabel |
| `GEMINI_CHAT_MODEL` | tidak | `gemini-3.1-flash-lite` | Model generation |
| `CHAT_MAX_HISTORY_TURNS` | tidak | `6` | Pemotongan riwayat |
| `QUERY_REWRITE` | tidak | aktif | `0` untuk menonaktifkan query rewriting |

## Menjalankan

```
npm run build -w @rag/shared   # sekali / bila shared berubah
npm run dev -w server          # http://localhost:3000
npm run typecheck -w server
```

Tersedia juga `npm run start -w server` (tanpa watch) dan
`npm run build -w server`.

## Alur permintaan

```
POST /api/chat
  messages[]
    -> (multi-turn) query rewriting -> retrieval_query
    -> retrieval (hybrid/vector/fts + filter + RRF) -> top-k chunk (sources)
    -> prompt (riwayat + sumber + pertanyaan asli)
    -> Gemini -> answer + sitasi [S#]
```

## Endpoint

### GET /api/health

Status server + jumlah baris tabel.

```json
{ "status": "ok", "table": "pdp_corpus", "rows": 703 }
```

### GET /api/meta

Daftar dokumen untuk mengisi filter.

```json
{
  "documents": [
    {
      "document_id": "uu-27-2022",
      "document_title": "Undang-Undang Nomor 27 Tahun 2022 ...",
      "doc_type": "UU",
      "doc_number": 27,
      "doc_year": 2022
    }
  ]
}
```

### POST /api/search

Retrieval saja (tanpa LLM).

Request:

| Field | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `query` | string | ya | - | Pertanyaan / kata kunci |
| `k` | integer 1-50 | tidak | `8` | Jumlah hasil |
| `mode` | `hybrid` / `vector` / `fts` | tidak | `hybrid` | Metode retrieval |
| `filters` | object | tidak | - | `document_id`, `section`, `pasal_number` |

Response: `{ mode, usedFallback, notice, results[] }`, dengan tiap hasil:
`chunk_id`, `document_id`, `document_title`, `section`, `bab`, `bab_title`,
`bagian`, `pasal`, `pasal_number`, `ayat`, `ayat_number`, `angka`,
`page_start`, `page_end`, `text`, `parent_id`, `context_header`, `source`,
`document_type`, `doc_number`, `doc_year`, `corpus_version`, `content_type`,
`distance`.

### POST /api/chat

Retrieval + generation bersitasi (multi-turn).

Request:

| Field | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `messages` | array `{role, content}` | ya | - | Riwayat percakapan; `role` = `user`/`assistant`; pesan terakhir harus `user` |
| `k` | integer 1-20 | tidak | `6` | Jumlah chunk konteks |
| `mode` | `hybrid` / `vector` / `fts` | tidak | `hybrid` | Metode retrieval |
| `filters` | object | tidak | - | `document_id`, `section`, `pasal_number` |

Response:

| Field | Tipe | Keterangan |
|---|---|---|
| `answer` | string | Ringkasan awam + poin praktisi, dengan sitasi inline `[S#]`, diakhiri disclaimer |
| `citations` | array | Sumber yang benar-benar dipakai: `marker`, `chunk_id`, `label`, `document_id`, `section`, `pasal`, `ayat`, `page_start`, `page_end` |
| `sources` | array | Seluruh chunk hasil retrieval (nomor `[S#]` = indeks 1-based) |
| `mode` | string | Mode retrieval yang akhirnya dipakai |
| `usedFallback` | boolean | `true` bila embedding query gagal lalu beralih ke FTS |
| `notice` | string / null | Info (mis. dari cache, atau alasan fallback) |
| `retrieval_query` | string | Query aktual untuk retrieval (hasil query rewriting bila multi-turn) |

### GET /openapi.json dan GET /docs

- `/openapi.json` - dokumen OpenAPI 3.1 (dihasilkan dari skema zod).
- `/docs` - Swagger UI interaktif.

## Retrieval

- `hybrid`: full-text search + pencarian vektor, digabung dengan
  `RRFReranker` (Reciprocal Rank Fusion).
- `vector`: kemiripan makna saja.
- `fts`: kata kunci saja (tanpa panggilan embedding).

Detail:

- Query di-embed dengan `taskType = RETRIEVAL_QUERY`; hasil di-cache (LRU,
  maksimum 500 entri) sehingga pertanyaan berulang tidak memanggil API.
- `filters` menjadi predikat `WHERE` pada metadata
  (`document_id`, `section`, `pasal_number`).
- Jika embedding query gagal (mis. kuota API), otomatis fallback ke `fts`
  (`usedFallback = true`, `notice` menjelaskan).
- Kolom yang dikembalikan dibatasi ke metadata + `text` (tanpa vektor).

## Generation

- Model: `GEMINI_CHAT_MODEL` (default `gemini-3.1-flash-lite`),
  `temperature 0.2`.
- Aturan prompt: jawab hanya dari `SUMBER`, sitasi `[S#]`, struktur
  ringkasan awam lalu poin praktisi, abstain bila tidak ada dasar, dan
  disclaimer "bukan nasihat hukum".
- Sitasi di respons diturunkan dari marker `[S#]` yang muncul di `answer`.

## Query rewriting (multi-turn)

- Berjalan di `/api/chat`, sekali per request, sebelum retrieval.
- Syarat: `QUERY_REWRITE` aktif (default) dan ada riwayat sebelum pesan user
  terakhir (multi-turn). Single-turn dilewati.
- Memakai model generation (`temperature 0`) untuk mengubah pertanyaan
  lanjutan menjadi query mandiri (mengganti kata rujukan seperti "itu").
- Riwayat yang dipakai dipotong ke `CHAT_MAX_HISTORY_TURNS`.
- Hanya memengaruhi retrieval (`retrieval_query`), bukan teks jawaban.
- Bila gagal, fallback ke pesan user terakhir.

## Contoh

Health:

```
curl.exe -s http://localhost:3000/api/health
```

Search:

```
curl.exe -s -X POST http://localhost:3000/api/search ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"sanksi administratif\",\"k\":5}"
```

Chat single-turn:

```
curl.exe -s -X POST http://localhost:3000/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"kapan data pribadi harus dihapus?\"}],\"k\":5}"
```

Chat multi-turn:

```
curl.exe -s -X POST http://localhost:3000/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Apa sanksi administratif?\"},{\"role\":\"assistant\",\"content\":\"Diatur dalam Pasal 57.\"},{\"role\":\"user\",\"content\":\"Siapa yang menjatuhkannya?\"}],\"k\":5}"
```

## Catatan

- Kuota Gemini: kuota generation terpisah dari kuota embedding; chat
  menghemat lewat cache embedding dan pemotongan riwayat.
- LanceDB bisa mengeluarkan peringatan deprecation `_score`/`_distance`
  (bawaan SDK TypeScript); tidak memengaruhi hasil.
- `@rag/shared` berisi tipe, embedder, dan klien LanceDB; jalankan
  `npm run build -w @rag/shared` bila paket itu berubah.
