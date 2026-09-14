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

app.use((_req, res) => {
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
