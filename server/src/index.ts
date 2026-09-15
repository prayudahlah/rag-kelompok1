import fs from "node:fs";
import path from "node:path";

import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";

import { config } from "./config.js";
import { buildOpenApiDocument } from "./openapi.js";
import { apiRouter } from "./routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const openApiDocument = buildOpenApiDocument();

app.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument),
);

app.use("/api", apiRouter);

// Sajikan hasil build client (Vite) bila tersedia. Di mode dev, client
// dilayani Vite sehingga build ini biasanya belum ada.
const clientIndexHtml = path.join(
  config.clientDistPath,
  "index.html",
);
const hasClientBuild = fs.existsSync(clientIndexHtml);

if (hasClientBuild) {
  app.use(express.static(config.clientDistPath));
}

app.use((req, res) => {
  if (
    hasClientBuild &&
    (req.method === "GET" || req.method === "HEAD") &&
    !req.path.startsWith("/api")
  ) {
    res.sendFile(clientIndexHtml);

    return;
  }

  res.status(404).json({
    error: { message: "Endpoint tidak ditemukan." },
  });
});

app.listen(config.port, () => {
  console.log(
    `Server berjalan di http://localhost:${config.port}`,
  );
  console.log(
    `Swagger UI : http://localhost:${config.port}/docs`,
  );
  console.log(
    `OpenAPI    : http://localhost:${config.port}/openapi.json`,
  );
});
