import { createDocument } from "zod-openapi";

import { config } from "./config.js";
import {
  ChatRequestSchema,
  ChatResponseSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  MetaResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema,
} from "./schemas.js";

export function buildOpenApiDocument() {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "PDP RAG API",
      version: "1.0.0",
      description:
        "Retrieval API untuk korpus hukum Pelindungan Data Pribadi " +
        "(UU 27/2022 dan PP 71/2019).",
    },
    servers: [
      { url: `http://localhost:${config.port}` },
    ],
    tags: [
      {
        name: "retrieval",
        description: "Pencarian chunk relevan",
      },
      {
        name: "meta",
        description: "Metadata & status",
      },
    ],
    paths: {
      "/api/search": {
        post: {
          tags: ["retrieval"],
          summary: "Cari chunk relevan",
          description:
            "Pencarian hybrid (vektor + full-text + RRF). Jika embedding query gagal (mis. kuota habis), otomatis fallback ke FTS.",
          requestBody: {
            content: {
              "application/json": {
                schema: SearchRequestSchema,
              },
            },
          },
          responses: {
            200: {
              description: "Hasil pencarian",
              content: {
                "application/json": {
                  schema: SearchResponseSchema,
                },
              },
            },
            400: {
              description: "Validasi request gagal",
              content: {
                "application/json": {
                  schema: ErrorResponseSchema,
                },
              },
            },
          },
        },
      },
      "/api/chat": {
        post: {
          tags: ["retrieval"],
          summary: "Jawaban bersitasi (multi-turn)",
          description:
            "Retrieval + generation Gemini. Jawaban hanya dari konteks; " +
            "abstain bila tidak ada dasar. Bukan nasihat hukum.",
          requestBody: {
            content: {
              "application/json": {
                schema: ChatRequestSchema,
              },
            },
          },
          responses: {
            200: {
              description: "Jawaban bersitasi",
              content: {
                "application/json": {
                  schema: ChatResponseSchema,
                },
              },
            },
            400: {
              description: "Validasi request gagal",
              content: {
                "application/json": {
                  schema: ErrorResponseSchema,
                },
              },
            },
          },
        },
      },
      "/api/meta": {
        get: {
          tags: ["meta"],
          summary: "Daftar dokumen",
          description:
            "Daftar dokumen yang tersedia di korpus (untuk filter).",
          responses: {
            200: {
              description: "Daftar dokumen",
              content: {
                "application/json": {
                  schema: MetaResponseSchema,
                },
              },
            },
          },
        },
      },
      "/api/health": {
        get: {
          tags: ["meta"],
          summary: "Health check",
          responses: {
            200: {
              description: "Status server",
              content: {
                "application/json": {
                  schema: HealthResponseSchema,
                },
              },
            },
          },
        },
      },
    },
  });
}
