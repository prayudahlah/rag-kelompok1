import { Router } from "express";

import {
  ChatRequestSchema,
  SearchRequestSchema,
} from "./schemas.js";
import { getTable, search } from "./retrieval/search.js";
import { chat } from "./generation/chat.js";

export const apiRouter = Router();

apiRouter.post("/search", async (req, res) => {
  const parsed = SearchRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: {
        message: "Validasi request gagal.",
        details: parsed.error.issues,
      },
    });

    return;
  }

  const { query, k, mode, filters } = parsed.data;

  try {
    const outcome = await search({
      query,
      k,
      mode,
      filters,
    });

    res.json(outcome);
  } catch (error) {
    res.status(500).json({
      error: {
        message: (error as Error).message,
      },
    });
  }
});

apiRouter.post("/chat", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: {
        message: "Validasi request gagal.",
        details: parsed.error.issues,
      },
    });

    return;
  }

  try {
    const outcome = await chat(parsed.data);

    res.json(outcome);
  } catch (error) {
    res.status(500).json({
      error: {
        message: (error as Error).message,
      },
    });
  }
});

apiRouter.get("/meta", async (_req, res) => {
  try {
    const table = await getTable();

    const rows = (await table
      .query()
      .select([
        "document_id",
        "document_title",
        "document_type",
        "doc_number",
        "doc_year",
      ])
      .toArray()) as Array<Record<string, unknown>>;

    const byId = new Map<
      string,
      {
        document_id: string;
        document_title: string;
        doc_type: string;
        doc_number: number;
        doc_year: number;
      }
    >();

    for (const row of rows) {
      const documentId = String(row.document_id);

      if (!byId.has(documentId)) {
        byId.set(documentId, {
          document_id: documentId,
          document_title: String(row.document_title),
          doc_type: String(row.document_type),
          doc_number: Number(row.doc_number),
          doc_year: Number(row.doc_year),
        });
      }
    }

    res.json({ documents: [...byId.values()] });
  } catch (error) {
    res.status(500).json({
      error: {
        message: (error as Error).message,
      },
    });
  }
});

apiRouter.get("/health", async (_req, res) => {
  try {
    const table = await getTable();
    const rows = await table.countRows();

    res.json({
      status: "ok",
      table: "pdp_corpus",
      rows,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: {
        message: (error as Error).message,
      },
    });
  }
});
