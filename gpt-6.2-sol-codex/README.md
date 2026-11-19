# gpt-6.2-sol-codex (prebuilt bundle)

Static Pocket World bundle for **GPT 6.2 Sol (Codex)** at port **5145**.

The original source (src/, package.json) was never added to this repository, so
the world is shipped as the built `index.html` + `assets/*` that were extracted
from the running `ai-arena-arena-1` container on 2026-11-19:

```bash
docker cp ai-arena-arena-1:/srv/models/gpt-6.2-sol-codex ./gpt-6.2-sol-codex
```

`Dockerfile` copies this folder straight into `/srv/models/gpt-6.2-sol-codex`
(no npm build stage). Replace it with a real build stage if the source shows up.
