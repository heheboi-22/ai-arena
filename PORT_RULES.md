# 🌐 Aturan Port & Routing Model AI (Aggregator & Caddy Router)

Dokumen ini menetapkan standardisasi alokasi port lokal untuk setiap model AI serta konfigurasi routing Caddy.

---

## 📌 1. Tabel Alokasi Port Model

Setiap agen model AI menjalankan dev server atau preview server-nya pada port berikut:

| No | Model Folder (`ID`) | Nama Model | Port Standar | Command Menjalankan Server |
|:---:|:---|:---|:---:|:---|
| 1 | `gemini-3.7-flash` | Gemini 3.7 Flash | **5101** | `npx serve -s -l 5101 dist` |
| 2 | `gemini-3.8-flash` | Gemini 3.8 Flash | **5102** | `npx serve -s -l 5102 dist` |
| 3 | `deepseek-v4.1-flash-coreweave` | DeepSeek v4.1 Flash (CoreWeave) | **5103** | `npx serve -s -l 5103 dist` |
| 4 | `deepseek-v4.1-flash-freebuff` | DeepSeek v4.1 Flash (Freebuff) | **5104** | `npx serve -s -l 5104 dist` |
| 5 | `deepseek-v4-flash-0731-coreweave` | DeepSeek v4 Flash 0731 (CoreWeave) | **5105** | `npx serve -s -l 5105 dist` |
| 6 | `glm-5.2-coreweave` | GLM 5.2 (CoreWeave) | **5106** | `npx serve -s -l 5106 dist` |
| 7 | `glm-5.3-flash-coreweave` | GLM 5.3 Flash (CoreWeave) | **5107** | `npx serve -s -l 5107 dist` |
| 8 | `glm-5.3-flash-freebuff` | GLM 5.3 Flash (Freebuff) | **5108** | `npx serve -s -l 5108 dist` |
| 9 | `mimo-v2.6-flash` | MIMO v2.6 Flash | **5109** | `npx serve -s -l 5109 dist` |
| 10 | `muse-spark-1.3-opencode` | Muse Spark 1.3 (Opencode) | **5110** | `npx serve -s -l 5110 dist` |
| 11 | `claude-sonnet-4.6-antigravity` | Claude Sonnet 4.6 (Antigravity) | **5111** | `npx serve -s -l 5111 dist` |
| 12 | `claude-opus-4.6-antigravity` | Claude Opus 4.6 (Antigravity) | **5112** | `npx serve -s -l 5112 dist` |
| 13 | `gpt-6-luna-codex` | GPT 6 Luna (Codex) | **5113** | `npx serve -s -l 5113 dist` |
| 14 | `gpt-5.6-luna-codex` | GPT 5.6 Luna (Codex) | **5114** | `npx serve -s -l 5114 dist` |
| 15 | `opus-5.5-cursor` | Opus 5.5 (Cursor) | **5115** | `npx serve -s -l 5115 dist` |
| 16 | `grok-4.7-cursor` | Grok 4.7 (Cursor) | **5116** | `npx serve -s -l 5116 dist` |
| 17 | `space-bunny-cline` | Space Bunny (Cline) | **5117** | `npx serve -s -l 5117 dist` |
| 18 | `longcat-2.5-opencode` | LongCat 2.5 (Opencode) | **5118** | `npx serve -s -l 5118 dist` |
| 19 | `gpt-6.1-sol-codex` | GPT 6.1 Sol (Codex) | **5119** | `npx serve -s -l 5119 dist` |
| 20 | `gpt-6-astra-codex` | GPT 6 Astra (Codex) | **5120** | `npx serve -s -l 5120 dist` |
| 21 | `glm-5.3-flash-zcode` | GLM 5.3 Flash (ZCode) | **5121** | `npx serve -s -l 5121 dist` |
| 22 | `ling-3.1-flash-opencode` | Ling 3.1 Flash (Opencode) | **5122** | `npx serve -s -l 5122 dist` |
| 23 | `fledge-alpha-opencode` | Fledge Alpha (Opencode) | **5123** | `npx serve -s -l 5123 dist` |
| 24 | `claude-haiku-5.5-claude` | Claude Haiku 5.5 (Claude) | **5124** | `npx serve -s -l 5124 dist` |
| 25 | `claude-sonnet-5.5-claude` | Claude Sonnet 5.5 (Claude) | **5125** | `npx serve -s -l 5125 dist` |
| 26 | `claude-opus-5.5-claude` | Claude Opus 5.5 (Claude) | **5126** | `npx serve -s -l 5126 dist` |
| 27 | `kimi-k3-workbuddy` | Kimi K3 (WorkBuddy) | **5127** | `npx serve -s -l 5127 dist` |
| 28 | `gemini-4-argon-antigravity` | Gemini 4 Argon (Antigravity) | **5128** | `npx serve -s -l 5128 dist` |
| 29 | `glm-5.3-codebuddy` | GLM 5.3 (CodeBuddy) | **5129** | `npx serve -s -l 5129 dist` |
| 30 | `kimi-k2.8-codebuddy` | Kimi K2.8 (CodeBuddy) | **5130** | `npx serve -s -l 5130 dist` |
| 31 | `deepseek-v4.1-flash-1017-dsh` | DeepSeek v4.1 Flash 1017 (DeepSeek Harness) | **5131** | `npx serve -s -l 5131 dist` |
| 32 | `claude-fable-5.2-claude` | Claude Fable 5.2 (Claude) | **5132** | `npx serve -s -l 5132 dist` |

> [!TIP]
> **Formula Port**: `5100 + Nomor Urut Model`.
> Command dijalankan dari dalam folder model, setelah `npx vite build`.
> Mode dev (`npm run dev -- --port <PORT> --host`) hanya untuk develop lokal via port langsung, bukan via subpath Caddy.

---

## 🔀 2. Cara Kerja Routing Caddy

Caddy berjalan di port **`:8080`**.

1. **Akses Dashboard Agregator**:
   - Lokal: `http://localhost:8080/`
   - Publik (Cloudflare): `https://ai-arena.nadif.dev/`
   - Berisi daftar semua model, status online/offline, dan fitur perbandingan berdampingan (Side-by-Side / 2x2 Grid).

2. **Akses Langsung Model AI**:
   - `https://ai-arena.nadif.dev/{nama-model-ai}/` atau `http://localhost:8080/{nama-model-ai}/`:
     - `https://ai-arena.nadif.dev/gemini-3.7-flash/` ➡️ `http://127.0.0.1:5101/`
     - `https://ai-arena.nadif.dev/gemini-3.8-flash/` ➡️ `http://127.0.0.1:5102/`
     - `https://ai-arena.nadif.dev/deepseek-v4.1-flash-coreweave/` ➡️ `http://127.0.0.1:5103/`
     - `https://ai-arena.nadif.dev/glm-5.2-coreweave/` ➡️ `http://127.0.0.1:5106/`
     - `https://ai-arena.nadif.dev/glm-5.3-flash-coreweave/` ➡️ `http://127.0.0.1:5107/`
     - `https://ai-arena.nadif.dev/mimo-v2.6-flash/` ➡️ `http://127.0.0.1:5109/`
     - `https://ai-arena.nadif.dev/muse-spark-1.3-opencode/` ➡️ `http://127.0.0.1:5110/`
     - `https://ai-arena.nadif.dev/claude-sonnet-4.6-antigravity/` ➡️ `http://127.0.0.1:5111/`
     - `https://ai-arena.nadif.dev/claude-opus-4.6-antigravity/` ➡️ `http://127.0.0.1:5112/`
     - `https://ai-arena.nadif.dev/gpt-6-luna-codex/` ➡️ `http://127.0.0.1:5113/`
     - ... dan seterusnya.
   - Redirect otomatis dari `/{nama-model-ai}` (tanpa trailing slash) ke `/{nama-model-ai}/`.
   - Caddyfile juga dilengkapi fallback otomatis ke port ad-hoc yang sedang aktif jika port standar belum dijalankan.

---

## 🚀 3. Menjalankan Caddy Router

Cukup jalankan perintah berikut di root folder:

```bash
caddy run
```

Atau dijalankan di background:

```bash
caddy start
```

---

## 🐳 4. Menjalankan via Docker (satu container, supervisord)

Pengganti `arena.sh` yang tidak butuh node, tmux, atau caddy di host. Semua
model dibangun di dalam **satu** image (multi-stage: `npm ci` → `vite build`
untuk tiap folder), lalu dijalankan di dalam **satu** container oleh supervisord:
Caddy sebagai router di `:8080` plus satu static server (`busybox httpd`) per
model di `127.0.0.1:5101-5132`, port yang sama dengan tabel di atas.

```bash
docker compose up -d --build             # bangun + jalankan
docker compose exec arena supervisorctl status   # 33 proses: caddy + 32 static
docker compose logs -f arena             # log router + event supervisord
docker compose down                      # hentikan
```

- Dashboard tetap di `http://localhost:8080/`. Mau ganti port host:
  `ARENA_PORT=9090 docker compose up -d`.
- **Build cepat karena cache per model.** Tiap folder punya pasangan layer
  sendiri: `package.json` + `package-lock.json` untuk `npm ci`, lalu isi
  foldernya untuk `vite build`. Docker hanya mengulang layer yang input-nya
  berubah, jadi mengubah satu model membangun ulang model itu saja, dan
  mengubah dashboard, dokumen, atau Caddyfile tidak membangun ulang model mana
  pun. Unduhan npm disimpan di cache mount BuildKit yang dipakai bersama oleh
  32 model, jadi `npm ci` yang memang harus jalan pun cuma hitungan detik.
- Hanya `:8080` yang di-publish. Static server model bind ke loopback di dalam
  container dan hanya bisa dijangkau Caddy, jadi angka port di tabel atas
  berlaku di dua tempat: mode lokal (host) dan di dalam container.
- File yang dipakai container: `Dockerfile` (satu file, membangun semua folder
  yang terdaftar di `aggregator/models.json`), `docker/Caddyfile` (upstream-nya
  `127.0.0.1:<port>`) dan `docker/supervisord.conf`.
- Program supervisord untuk tiap model **digenerate saat build** dari
  `aggregator/models.json` oleh `docker/gen-models-conf.mjs`, jadi port-nya tidak
  mungkin melenceng dari tabel.
- Model baru harus didaftarkan di **empat** tempat: satu blok build di
  `Dockerfile` (salin blok model lain, ganti nama foldernya), `Caddyfile`,
  `docker/Caddyfile`, dan `aggregator/models.json`. Blok di `Dockerfile` sengaja
  ditulis manual per model supaya cache-nya terpisah seperti di atas.
- Folder yang ada tapi tidak terdaftar di `models.json` (contoh:
  `pixel-canary-cline`, belum punya `src/main.ts`) tidak ikut dibangun. Dockerfile
  meng-copy folder per nama, bukan `*/`, jadi folder setengah jadi tidak
  menggagalkan seluruh build.
- Tunnel Cloudflare (`aggregator/cf-proxy/nginx.conf`) tetap bisa dipakai: ia
  menembak `host.docker.internal:8080`, yaitu port host yang sama dengan yang
  di-publish Caddy.
