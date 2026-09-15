# Deployment — Render (image dari GHCR)

Alur: **build image lokal → push ke GitHub Container Registry (GHCR) → Render pull image**.
Data LanceDB (`ingestion/data/lancedb`, ~2 MB) di-bake ke dalam image, jadi git tetap bersih
dan Render tidak butuh disk/SSH/one-off job.

- Image: `ghcr.io/prayudahlah/rag-kelompok1:latest`
- Satu container menyajikan API (`/api/*`, `/docs`) **dan** UI client di `/`.

## Prasyarat
- Docker Desktop/Engine.
- Repo: https://github.com/prayudahlah/rag-kelompok1
- Password/token GHCR (Personal Access Token dengan scope `write:packages`).
- Akun Render.

## 1. Build & push image
Jalankan dari root repo:

```powershell
docker build -t ghcr.io/prayudahlah/rag-kelompok1:latest .

# Login GHCR (sekali). Gunakan username GitHub + PAT sebagai password.
$env:CR_PAT = "<PAT_scope_write:packages>"
$env:CR_PAT | docker login ghcr.io -u prayudahlah --password-stdin

docker push ghcr.io/prayudahlah/rag-kelompok1:latest
```

Lalu jadikan package **public** agar Render tak perlu kredensial registry:
GitHub → (profil) → Packages → `rag-kelompok1` → Package settings → Change visibility → Public.
> Isi image tidak rahasia; `GEMINI_API_KEY` **tidak** pernah di-bake.

## 2. Buat Web Service di Render
1. **New → Web Service → Deploy an existing image**.
2. Image URL: `ghcr.io/prayudahlah/rag-kelompok1:latest`.
   - Jika package dibiarkan private, isi kredensial registry (username `prayudahlah` + PAT).
3. **Instance Type: Free**.
4. **Environment Variables**: `GEMINI_API_KEY = <key>`. (`PORT` diisi otomatis Render.)
5. **Health Check Path**: `/api/health`.
6. Deploy. Cek `https://<nama>.onrender.com/api/health` mengembalikan `{ "status": "ok", "rows": 703 }`.

## 3. Custom domain (Cloudflare)
1. Render → Settings → **Custom Domains** → tambah `prayudahlah.dev`.
2. Render memberi target (A/CNAME). Di Cloudflare DNS, buat record sesuai target tersebut.
   - Awan **abu-abu (DNS only)** paling sederhana (TLS ditangani Render).
   - Jika tetap proxy oranye, set SSL/TLS mode **Full (strict)**.
3. Tunggu verifikasi + sertifikat TLS otomatis Render.

## 4. Update data / rilis berikutnya
```powershell
# 1) (bila data berubah) jalankan ingestion lokal lebih dulu
npm run pipeline -w ingestion

# 2) build ulang + push
docker build -t ghcr.io/prayudahlah/rag-kelompok1:latest .
docker push ghcr.io/prayudahlah/rag-kelompok1:latest
```
Render **tidak** auto-deploy untuk tag `:latest`. Picu manual lewat dashboard
(**Manual Deploy → Deploy latest**) atau simpan **Deploy Hook** dari Render lalu:
```powershell
Invoke-WebRequest -Method Post "<DEPLOY_HOOK_URL>"
```
> Untuk auto-deploy, gunakan tag versi unik (mis. `:v2`) dan set image URL di Render,
> atau tambahkan GitHub Actions yang push + memanggil deploy hook.

## Catatan
- **Cold start**: instance free tidur setelah idle; request pertama bisa lambat (~30–60 dtk).
- Runtime hanya **membaca** LanceDB, jadi filesystem ephemeral Render aman.
- Port `3000` hanya internal container; Render menerminasi TLS di edge.
- `POST /api/chat` memakai Gemini; pastikan kuota API key mencukupi.

## Fallback VPS (opsional)
Dockerfile yang sama bisa dipakai di VPS dengan `docker compose` + Caddy untuk TLS.
Belum disiapkan; tambahkan `docker-compose.yml` + `Caddyfile` bila beralih ke VPS.
