import { z } from "zod";

export const SectionEnum = z
  .enum([
    "pembukaan",
    "batang_tubuh",
    "pengesahan",
    "penjelasan",
  ])
  .meta({
    id: "Section",
    description: "Bagian dokumen",
    example: "batang_tubuh",
  });

export const SearchFiltersSchema = z
  .object({
    document_id: z
      .string()
      .optional()
      .meta({
        description: "Filter berdasarkan dokumen",
        example: "uu-27-2022",
      }),
    section: SectionEnum.optional(),
    pasal_number: z
      .number()
      .int()
      .optional()
      .meta({
        description: "Filter berdasarkan nomor Pasal",
        example: 16,
      }),
  })
  .meta({
    id: "SearchFilters",
    description: "Filter metadata pencarian",
  });

export const SearchRequestSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .meta({
        description: "Pertanyaan / kata kunci",
        example: "kapan data pribadi harus dihapus?",
      }),
    k: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(8)
      .meta({ description: "Jumlah hasil", example: 8 }),
    mode: z
      .enum(["hybrid", "vector", "fts"])
      .default("hybrid")
      .meta({
        description:
          "Metode pencarian: hybrid (vektor+FTS), vector, atau fts",
        example: "hybrid",
      }),
    filters: SearchFiltersSchema.optional(),
  })
  .meta({
    id: "SearchRequest",
    description: "Permintaan pencarian",
  });

export const SearchResultSchema = z
  .object({
    chunk_id: z.string(),
    document_id: z.string(),
    document_title: z.string(),
    section: SectionEnum,
    bab: z.string().nullable(),
    bab_title: z.string().nullable(),
    bagian: z.string().nullable(),
    pasal: z.string().nullable(),
    pasal_number: z.number().nullable(),
    ayat: z.string().nullable(),
    ayat_number: z.number().nullable(),
    angka: z.number().nullable(),
    page_start: z.number(),
    page_end: z.number(),
    text: z.string(),
    parent_id: z.string().nullable(),
    context_header: z.string().nullable(),
    source: z.string(),
    document_type: z.string(),
    doc_number: z.number(),
    doc_year: z.number(),
    corpus_version: z.string(),
    content_type: z.string(),
    distance: z.number().nullable(),
  })
  .meta({
    id: "SearchResult",
    description: "Satu chunk hasil pencarian",
  });

export const SearchResponseSchema = z
  .object({
    mode: z.enum(["hybrid", "vector", "fts"]),
    usedFallback: z.boolean(),
    notice: z.string().nullable(),
    results: z.array(SearchResultSchema),
  })
  .meta({
    id: "SearchResponse",
    description: "Hasil pencarian",
  });

export const MetaResponseSchema = z
  .object({
    documents: z.array(
      z.object({
        document_id: z.string(),
        document_title: z.string(),
        doc_type: z.string(),
        doc_number: z.number(),
        doc_year: z.number(),
      }),
    ),
  })
  .meta({
    id: "MetaResponse",
    description: "Daftar dokumen untuk filter",
  });

export const HealthResponseSchema = z
  .object({
    status: z.string(),
    table: z.string(),
    rows: z.number(),
  })
  .meta({
    id: "HealthResponse",
    description: "Status server",
  });

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({
    id: "ErrorResponse",
    description: "Kesalahan",
  });

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const ChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
  })
  .meta({
    id: "ChatMessage",
    description: "Satu pesan percakapan",
  });

export const ChatRequestSchema = z
  .object({
    messages: z
      .array(ChatMessageSchema)
      .min(1)
      .meta({
        description:
          "Riwayat percakapan (multi-turn). Pesan terakhir harus dari user.",
      }),
    k: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(6)
      .meta({
        description: "Jumlah chunk konteks yang diambil",
        example: 6,
      }),
    mode: z
      .enum(["hybrid", "vector", "fts"])
      .default("hybrid")
      .meta({ description: "Metode retrieval" }),
    filters: SearchFiltersSchema.optional(),
  })
  .meta({
    id: "ChatRequest",
    description: "Permintaan jawaban bersitasi",
  });

export const CitationSchema = z
  .object({
    marker: z.string().meta({ example: "[S1]" }),
    chunk_id: z.string(),
    label: z.string(),
    document_id: z.string(),
    section: SectionEnum,
    pasal: z.string().nullable(),
    ayat: z.string().nullable(),
    page_start: z.number(),
    page_end: z.number(),
  })
  .meta({
    id: "Citation",
    description: "Sitasi satu sumber",
  });

export const ChatResponseSchema = z
  .object({
    answer: z.string(),
    citations: z.array(CitationSchema),
    sources: z.array(SearchResultSchema),
    mode: z.enum(["hybrid", "vector", "fts"]),
    usedFallback: z.boolean(),
    notice: z.string().nullable(),
    retrieval_query: z.string().meta({
      description:
        "Query yang dipakai untuk retrieval (hasil query rewriting pada multi-turn)",
    }),
  })
  .meta({
    id: "ChatResponse",
    description: "Jawaban bersitasi",
  });

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
