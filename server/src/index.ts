import "dotenv/config";

import express from "express";
import cors from "cors";

import { config } from "./config.js";
import { retrieve } from "./retriever.js";
import { generate } from "./generator.js";
import { rewriteQuery } from "./rewriter.js";
import type { ChatRequest, ChatResponse } from "./types.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { question, history } = req.body as ChatRequest;

    if (!question || typeof question !== "string" || question.trim() === "") {
      res.status(400).json({ error: "question wajib diisi" });
      return;
    }

    console.log(`[CHAT] Pertanyaan: ${question}`);

    let searchQuery = question;
    let rewrittenQuery: string | undefined;

    if (history && history.length > 0) {
      console.log(`[REWRITE] Merewrite pertanyaan dengan ${history.length} pesan riwayat...`);
      rewrittenQuery = await rewriteQuery(history, question);
      searchQuery = rewrittenQuery;
      console.log(`[REWRITE] Hasil: ${rewrittenQuery}`);
    }

    const sources = await retrieve(searchQuery);
    console.log(`[RETRIEVE] Ditemukan ${sources.length} chunks`);

    const answer = await generate(searchQuery, sources);
    console.log(`[GENERATE] Jawaban: ${answer.substring(0, 100)}...`);

    const response: ChatResponse = { answer, sources };
    if (rewrittenQuery) {
      response.rewrittenQuery = rewrittenQuery;
    }

    res.json(response);
  } catch (error) {
    console.error("[ERROR]", error);
    res.status(500).json({
      error: "Terjadi kesalahan saat memproses pertanyaan.",
    });
  }
});

app.listen(config.port, () => {
  console.log(`Server jalan di http://localhost:${config.port}`);
  console.log(`LanceDB path: ${config.lancedbPath}`);
});
