# syntax=docker/dockerfile:1

# ---------- Builder ----------
# Bangun @rag/shared, server (tsc), dan client (Vite) dalam satu monorepo.
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Manifests dulu agar layer npm ci bisa di-cache.
COPY package.json package-lock.json ./
COPY ingestion/package.json ./ingestion/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
COPY eval/package.json ./eval/package.json

RUN npm ci

COPY . .

# Urutan build: @rag/shared -> server -> client.
RUN npm run build

# Buang devDependencies + paket berat yang tidak dipakai runtime:
# - ML opsional dari @lancedb/lancedb (kita embed lewat API Gemini, bukan lokal)
# - dependency khusus client (sudah jadi static build) dan eval
RUN npm prune --omit=dev && \
    npm cache clean --force && \
    rm -rf \
      node_modules/onnxruntime-node \
      node_modules/onnxruntime-web \
      node_modules/@huggingface \
      node_modules/@img \
      node_modules/sharp \
      node_modules/@llamaindex \
      node_modules/vega \
      node_modules/vega-lite \
      node_modules/lucide-react \
      node_modules/react \
      node_modules/react-dom \
      node_modules/react-markdown \
      node_modules/remark-gfm \
      node_modules/@types \
      node_modules/@typescript

# ---------- Runtime ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# node_modules (termasuk symlink workspace @rag/shared) + hasil build.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Data LanceDB di-bake ke dalam image (runtime hanya membaca).
COPY --from=builder /app/ingestion/data/lancedb ./ingestion/data/lancedb

# cwd = server agar default LANCEDB_PATH (../ingestion/data/lancedb) benar.
WORKDIR /app/server
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
