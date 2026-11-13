# MODELS.md - catatan model, effort, reasoning, harness, provider

Satu baris per folder model di repo ini. Kolom `Effort` terisi seluruhnya: repo ini
tidak menyimpannya sama sekali, jadi nilainya berasal dari catatan sesi pemilik
repo dan dari berkas harness di mesin ini (lihat bagian Sumber di bawah). Effort
dan reasoning tidak dipisah jadi dua kolom karena keduanya setelan yang sama.

Kolom `From` diambil dari field `tag` di `aggregator/models.json` kalau ada.
Kolom `Harness` dan `Provider` dibaca dari akhiran nama folder. Sebagian baris
hanya bisa diketahui dari catatan sesi pemilik repo, bukan dari file di repo:
effort tiap harness (lihat legenda di bawah tabel), harness baris CoreWeave,
Freebuff, dan DSH, serta provider baris CoreWeave, Freebuff, WorkBuddy, CodeBuddy, Cline, dan OpenCode.
Satu pengecualian: `mimo-v2.6-flash`, karena nama foldernya tidak menyebut harness
sama sekali — nilainya dibaca dari sesi di `opencode.db` (lihat bagian Sumber).
Kolom harness dan provider sudah terisi semua.

## Tabel

| Model | From (pembuat) | Effort | Harness | Provider (inference) | Folder |
|:--|:--|:--|:--|:--|:--|
| Claude Fable 5.2 | Anthropic | medium | Claude Code | Anthropic | `claude-fable-5.2-claude` |
| Claude Haiku 5.5 | Anthropic | xhigh | Claude Code | Anthropic | `claude-haiku-5.5-claude` |
| Claude Opus 4.6 | Anthropic | default | Google Antigravity | Google | `claude-opus-4.6-antigravity` |
| Claude Opus 5.5 | Anthropic | xhigh | Claude Code | Anthropic | `claude-opus-5.5-claude` |
| Claude Sonnet 4.6 | Anthropic | high | Google Antigravity | Anthropic | `claude-sonnet-4.6-antigravity` |
| Claude Sonnet 5.5 | Anthropic | xhigh | Claude Code | Anthropic | `claude-sonnet-5.5-claude` |
| DeepSeek v4 Flash 0731 | DeepSeek | default | OpenCode | CoreWeave | `deepseek-v4-flash-0731-coreweave` |
| DeepSeek v4.1 Flash | DeepSeek | default | OpenCode | CoreWeave | `deepseek-v4.1-flash-coreweave` |
| DeepSeek v4.1 Flash | DeepSeek | max | Freebuff | Freebuff | `deepseek-v4.1-flash-freebuff` |
| DeepSeek v4.1 Flash 1017 | DeepSeek | max | DeepSeek Harness | DeepSeek | `deepseek-v4.1-flash-1017-dsh` |
| DeepSeek v4.1 Flash 1017 | DeepSeek | default | OpenCode | CoreWeave | `deepseek-v4.1-flash-1017-coreweave` |
| Fledge Alpha | Inkling (Inkling 2 Small) | max | OpenCode | OpenCode | `fledge-alpha-opencode` |
| Gemini 3.1 Pro | Google * | high | Google Antigravity | Google | `gemini-3.1-pro-antigraivty` |
| Gemini 3.7 Flash | Google | high | Google Antigravity | Google | `gemini-3.7-flash` |
| Gemini 3.8 Flash | Google | high | Google Antigravity | Google | `gemini-3.8-flash` |
| Gemini 4 Argon | Google * | high | Google Antigravity | Google | `gemini-4-argon-antigravity` |
| Gemini 4 Argon | Google * | xhigh | Cline | Cline | `gemini-4-argon-cline` |
| Gemini 4 Carbon | Google | high | OpenCode | Coarena | `gemini-4-carbon-coarena` |
| Gemini 4 Hydrogen | Google | high | Google Antigravity | Google | `gemini-4-hydrogen-antigraivty` |
| GLM 5.2 | Zhipu AI | default | OpenCode | CoreWeave | `glm-5.2-coreweave` |
| GLM 5.3 | Zhipu AI * | max | ZCode | Z.ai | `glm-5.3-zcode` |
| GLM 5.3 | Zhipu AI | max | CodeBuddy | CodeBuddy | `GLM-5.3-Codebuddy` |
| GLM 5.3 Flash | Zhipu AI | default | OpenCode | CoreWeave | `glm-5.3-flash-coreweave` |
| GLM 5.3 Flash | Zhipu AI | max | Freebuff | Freebuff | `glm-5.3-flash-freebuff` |
| GLM 5.3 Flash | Zhipu AI | max | ZCode | Z.ai | `glm-5.3-flash-zcode` |
| GPT 5.6 Luna | OpenAI | xhigh | Codex CLI | OpenAI | `gpt-5.6-luna-codex` |
| GPT 6 Astra | OpenAI | xhigh | Codex CLI | OpenAI | `gpt-6-astra-codex` |
| GPT 6 Luna | OpenAI | xhigh | Codex CLI | OpenAI | `gpt-6-luna-codex` |
| GPT 6 Sol | OpenAI * | xhigh | Zed | OpenAI | `gpt-6-sol-zed` |
| GPT 6.1 Sol | OpenAI | xhigh | Codex CLI | OpenAI | `gpt-6.1-sol-codex` |
| Grok 4.7 | xAI | xhigh | Cursor | xAI | `grok-4.7-cursor` |
| Kimi K2.8 | Moonshot AI | max | CodeBuddy | CodeBuddy | `Kimi-K2.8-Codebuddy` |
| Kimi K3 | Moonshot AI | default | WorkBuddy | WorkBuddy | `kimi-k3-workbuddy` |
| Ling 3.1 Flash | Ling | default | OpenCode | OpenCode | `ling-3.1-flash-opencode` |
| LongCat 2.5 | LongCat | default | OpenCode | OpenCode | `longcat-2.5-opencode` |
| MiMo v2.6 Flash | Xiaomi / MIMO | default | OpenCode | Xiaomi | `mimo-v2.6-flash` |
| Muse Spark 1.3 | Muse / Spark | xhigh | OpenCode | OpenCode | `muse-spark-1.3-opencode` |
| Muse Spark 1.3 | Meta | xhigh | Muse | Meta | `muse-spark-1.3-muse` |
| Opus 5.5 | Anthropic | medium | Cursor | Anthropic | `opus-5.5-cursor` |
| Pixel Canary | ? | default | Cline | Cline | `pixel-canary-cline` |
| Space Bunny | MiniMax (pre-release-minimax-m3.1-flash) | default | Cline | Cline | `space-bunny-cline` |

`TBD` = belum dicatat, isi manual. Satu nilai untuk effort sekaligus reasoning.
Setelah seluruh baris terisi, tidak ada baris yang masih memakai nilai ini.
`xhigh` terpakai di empat baris Codex CLI, tiga baris Claude Code, satu baris Cline
(`gemini-4-argon-cline`), satu baris OpenCode (`muse-spark-1.3-opencode`), satu
baris Cursor (`grok-4.7-cursor`), dan satu baris Zed (`gpt-6-sol-zed`), dari
catatan sesi pemilik repo serta setelan harness di mesin ini, bukan hasil
pembacaan file di repo.
`default` = dibiarkan di setelan bawaan harness, bukan nilai yang dipilih sendiri.
Terpakai di satu baris Antigravity, seluruh baris CoreWeave (4), dua baris OpenCode
(`ling-3.1-flash-opencode`, `longcat-2.5-opencode`), dua baris Cline
(`pixel-canary-cline`, `space-bunny-cline`), `mimo-v2.6-flash`, dan
`kimi-k3-workbuddy`. Alasannya beda-beda: Ling, LongCat, dan MiMo cuma punya toggle
reasoning tanpa tingkatan effort; Pixel Canary dan Space Bunny tidak punya setelan
effort sama sekali; Opus 4.6 Antigravity dan baris CoreWeave dibiarkan di setelan
bawaan; Kimi K3 diisi `default` dari catatan pemilik repo.
`max` = setelan tertinggi, terpakai di seluruh baris Freebuff (2 baris), seluruh
baris ZCode (2 baris), satu baris OpenCode (`fledge-alpha-opencode`), dua baris
CodeBuddy (`GLM-5.3-Codebuddy` dan `Kimi-K2.8-Codebuddy`), serta satu baris
DeepSeek Harness (`deepseek-v4.1-flash-1017-dsh`).
GLM 5.3 di ZCode awalnya ditulis `TBD` karena pemilik repo cuma ingat "tertinggi",
lalu diisi `max` setelah katalog model menunjukkan tingkatan tertinggi GLM 5.3
memang `max`; GLM 5.3 CodeBuddy dan Kimi K2.8 CodeBuddy dikonfirmasi pemilik repo
memakai reasoning `max`, begitu juga DeepSeek v4.1 Flash 1017 di DeepSeek Harness.
`medium` = setelan tengah, terpakai di satu baris Cursor (`opus-5.5-cursor`) dan
satu baris Claude Code (`claude-fable-5.2-claude`).
Grok 4.7 awalnya masuk aturan Cursor `medium`, lalu diganti `xhigh` lewat koreksi
pemilik repo, jadi baris Cursor tidak seragam.
`?` = tidak ada jejaknya di repo.
Provider di baris `claude-opus-4.6-antigravity` berisi Google, bukan Anthropic,
karena model itu dilayani lewat Antigravity, bukan lewat Anthropic langsung.
Baris `gemini-3.7-flash` dan `gemini-3.8-flash` harnessnya tidak terbaca dari nama
folder, diisi `Google Antigravity` dari catatan sesi pemilik repo, effortnya `high`
sama seperti baris Antigravity lain kecuali Opus 4.6.
`*` = diisi dari nama model, tidak ada field `tag` di `models.json` untuk folder itu.

## Akhiran folder jadi harness dan provider

Tabel ini yang dipakai untuk mengisi dua kolom di atas. Berguna saat menambah
model baru: pilih akhiran folder dulu, harness dan provider ikut sendiri.

| Akhiran folder | Harness | Provider |
|:--|:--|:--|
| `-claude` | Claude Code | Anthropic |
| `-codex` | Codex CLI | OpenAI |
| `-cursor` | Cursor | sesuai model (Anthropic, xAI) |
| `-cline` | Cline | Cline |
| `-antigravity` | Google Antigravity | sesuai model |
| `-opencode` | OpenCode | OpenCode |
| `-zcode` | ZCode | Z.ai |
| `-zed` | Zed | sesuai model |
| `-workbuddy` | WorkBuddy | WorkBuddy |
| `-codebuddy` / `-Codebuddy` | CodeBuddy | CodeBuddy |
| `-coreweave` | tidak tertulis, dari catatan sesi: OpenCode | CoreWeave |
| `-freebuff` | Freebuff | Freebuff |
| `-dsh` | tidak tertulis, dari catatan sesi: DeepSeek Harness | DeepSeek |
| tanpa akhiran | tidak tertulis | sesuai model |

## Sumber yang sudah dicek

Tidak ada di repo ini yang menyimpan effort, harness, atau provider:

- `aggregator/models.json`: hanya `id`, `name`, `port`, `fallbackPort`, `path`, `tag`, `color`.
- `arena.sh`: membaca `id` dan `port` saja.
- README tiap model: berisi fitur dan cara run, bukan setelan sesi.
- `.claude/launch.json`: satu konfigurasi preview untuk Claude Haiku 5.5.
- `git log`: lima commit, pesan commit tidak menyebut effort atau reasoning.

Di luar repo, beberapa berkas di mesin ini menyimpan datanya:

- `~/.cache/opencode/models.json`: katalog model dengan field `reasoning_options`.
  Ini yang menentukan apakah sebuah model punya tingkatan effort atau tidak, dan
  tingkatan mana yang tertinggi.
- `~/.local/share/opencode/opencode.db`, tabel `session_v2`: tiap sesi menyimpan
  `providerID`, `id`, dan `variant` yang dipakai. Sesi build arena ada di sini,
  misalnya `fledge-alpha-free` variant `max`, `ling-3.1-flash-free` tanpa variant,
  dan `mimo-v2.6-flash-free` dengan `providerID: opencode` tanpa variant
  (`Building Pocket World 3D diorama`, `/home/aorus/Project/testing`, 24 Sep 2026)
  — itu yang mengisi kolom `Harness` baris MiMo.
- `~/.local/state/opencode/model.json`: variant terakhir per model.
- `~/.var/app/dev.zed.Zed/config/zed/settings.json`: `agent.default_model` berisi
  `{"provider":"zed.dev","model":"gpt-6-sol","enable_thinking":true,"effort":"xhigh"}`.
  Itu sumber nilai `xhigh` untuk baris `gpt-6-sol-zed`. Berkasnya ditulis 15 Okt,
  jadi ini setelan terakhir, bukan log sesi build; backup 26 Sep berisi
  `gpt-6-luna` dengan `effort: medium`, model yang berbeda.
- `~/.zcode/cli/rollout/model-io-sess_*.jsonl`: tiga sesi memakai
  `GLM-5.3-Flash` dengan `"output_config":{"effort":"max"}`, jejak baris ZCode.
- `~/.zcode/v2/acp-lazy-sessions.json`: empat sesi ZCode di
  `/home/aorus/Project/testing/gpt-6-sol-zed`, salah satunya berjalan dengan
  model `GLM-5.3`. Ini asal folder `.zcode/acp` di dalam `gpt-6-sol-zed`, bukan
  harness yang dipakai untuk membangunnya.
- `~/.cline/data/sessions/*/*.json`: sesi Cline menyimpan `provider: cline` dan
  `model: stealth/pixel-canary` serta `stealth/space-bunny-alpha`, tapi tidak ada
  field effort sama sekali. Model `stealth/*` itu juga tidak ada di katalog, jadi
  tidak ada tingkatan yang bisa dibaca. Karena itu dua baris Cline diisi `default`.
- `~/.workbuddy/workbuddy.db`: tabel `sessions` kosong, nol baris, jadi belum ada
  sesi WorkBuddy yang terekam di mesin ini. Skemanya punya kolom `model` dan
  `thought_level`, jadi nilainya bisa dibaca kalau nanti ada sesi. Log
  `~/.workbuddy/logs/main.log` cuma menyebut daftar model (`kimi-k3-1`) tanpa
nilai thought level. Waktu pencatatan, folder `kimi-k3-workbuddy` di repo masih
kosong (sekarang sudah berisi source lengkap), jadi untuk baris Kimi K3 nilainya
`default` dari catatan pemilik repo.

Baris yang effortnya dari sumber-sumber itu:

| Model | Bukti di berkas | Hasil |
|:--|:--|:--|
| `fledge-alpha-free` | effort: low, high, max; variant sesi `max` | max |
| `ling-3.1-flash-free` | toggle saja, tanpa variant | default |
| `longcat-2.5-preview-free` | toggle saja, tanpa variant | default |
| `muse-spark-1.3-contributor-free` | effort sampai xhigh; variant sesi `xhigh` | xhigh |
| `gpt-6-sol` di Zed | `agent.default_model` effort `xhigh` | xhigh |
| `GLM-5.3` dan `GLM-5.3-Flash` di ZCode | `output_config.effort` `max`, dan katalog menaruh `max` sebagai tingkatan tertinggi | max |
| `mimo-v2.6-flash-free` | `reasoning_options` kosong, tidak ada tingkatan effort | default |
| `pixel-canary`, `space-bunny-alpha` di Cline | sesi Cline tanpa field effort, model `stealth/*` tidak ada di katalog | default |

Tiga baris pertama yang membuat klaim "effort tidak terekam di mana pun" di versi
awal catatan ini perlu diperbaiki: untuk harness opencode datanya ada, tinggal
dibaca. Untuk harness lain, sebagian nilainya masih dari catatan sesi pemilik repo.

Kolom Effort sekarang terisi di semua baris. Sebelas di antaranya dari berkas di
mesin ini, sisanya dari catatan sesi pemilik repo. Tidak ada lagi baris `TBD`
maupun sel `?`.

## Selisih folder dan `models.json`

46 folder model di repo (ditambah symlink `Gemini-4-Argon-Antigravity`), 41 terdaftar di `aggregator/models.json`. Lima folder
belum punya entri konsol:

- `gemini-3.1-pro-antigraivty`
- `gemini-4-argon-cline`
- `gemini-4-argon-web`
- `gpt-6-sol-zed`
- `pixel-canary-cline`

`kimi-k3-workbuddy` sekarang sudah berisi source Pocket World lengkap dan
terdaftar di port 5127.
`gemini-4-argon-antigravity` sekarang sudah berisi source Pocket World lengkap dan
terdaftar di port 5128.
`GLM-5.3-Codebuddy` sekarang sudah berisi source Pocket World lengkap dan
terdaftar di port 5129 (`glm-5.3-codebuddy`).
`Kimi-K2.8-Codebuddy` sekarang sudah berisi source Pocket World lengkap dan
terdaftar di port 5130 (`kimi-k2.8-codebuddy`).
`deepseek-v4.1-flash-1017-dsh` sekarang sudah berisi source Pocket World lengkap dan
terdaftar di port 5131.
`glm-5.3-zcode` sekarang sudah berisi source Pocket World lengkap dan
terdaftar di port 5132.
`deepseek-v4.1-flash-1017-coreweave` sekarang sudah berisi source Pocket World
lengkap (dikirim Arista Latif lewat WhatsApp) dan terdaftar di port 5136.
`hy-4-workbuddy` berisi source Pocket World lengkap (Three.js + Vite + TypeScript,
36/36 pemeriksaan headless Chromium lolos) dan terdaftar di port 5138.
`claude-fable-5.2-claude` berisi source Pocket World lengkap dan terdaftar di
port 5139 (di upstream tercatat 5132, digeser karena 5132-5138 sudah dipakai
world lain di working tree mesin ini).
`gemini-4-carbon-coarena` berisi source Pocket World lengkap dan terdaftar di port
5140. Harness-nya OpenCode, provider-nya Coarena (Coarena Model API); akhiran
folder di baris ini menunjuk provider, bukan harness. Effort-nya `high` dari
catatan pemilik repo.
`gemini-4-hydrogen-antigraivty` berisi source Pocket World lengkap
(Three.js + Vite + TypeScript, `tsc --noEmit` + `vite build` lolos) dan terdaftar
di port 5141.

Dua hal kecil yang ketemu waktu mencatat:

- Nama folder `gemini-3.1-pro-antigraivty` salah ketik, seharusnya `antigravity`.
- `Fledge Alpha` adalah codename stealth untuk model `Inkling 2 Small`, jadi kolom
  `From` baris itu diisi `Inkling (Inkling 2 Small)`, dan `tag` di `models.json`
  diganti dari `Fledge` ke `Inkling`. Nama tampil world tetap `Fledge Alpha`
  karena itu nama folder dan judul entri konsol.
- `tag` untuk `space-bunny-cline` di `models.json` dulu berisi `Pocket World`
  (judul brief), bukan nama pembuat; sudah diganti `MiniMax`. Model di baliknya
  `pre-release-minimax-m3.1-flash`, jadi baris itu dibaca
  `MiniMax (pre-release-minimax-m3.1-flash)`.
- `pixel-canary-cline` tidak punya entri di `models.json`, jadi tidak ada `tag`
  yang bisa dibaca; kolom `From` baris itu juga `?`.
