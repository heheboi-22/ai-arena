# ==============================================================================
# AI Arena: one image, one container, 32 processes
# ==============================================================================
#   docker compose up -d --build     then open http://localhost:8080/
#
# Why rebuilds are cheap. Every model is built in its OWN stage, with its own
# cache chain:
#
#   FROM ${NODE_IMAGE} AS m-<id>
#   COPY <id>/package.json <id>/package-lock.json  ->  npm ci
#   COPY <id>/                                     ->  npm run build
#
# Stages do not depend on each other, so changing one model cannot invalidate any
# other model, whichever position it sits in this file. Editing the dashboard, a
# doc or the Caddyfile rebuilds no model at all. npm's download cache lives in a
# BuildKit cache mount shared by every model, so an npm ci that does have to run
# stays quick.
#
# Adding a model: copy one stage block below, add one COPY --from line to the
# runtime stage, then register it in aggregator/models.json and both Caddyfiles
# (PORT_RULES.md, section 3). The supervisord program for it is generated from
# models.json at build time, so its port cannot drift from the table.
# ==============================================================================

ARG NODE_IMAGE=node:24-bookworm-slim
ARG CADDY_IMAGE=caddy:2-alpine

# ==============================================================================
# Stage per model: static bundle into /out
# ==============================================================================
# 5101  gemini-3.7-flash
FROM ${NODE_IMAGE} AS m-gemini-3.7-flash
WORKDIR /src
COPY gemini-3.7-flash/package.json gemini-3.7-flash/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY gemini-3.7-flash/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5102  gemini-3.8-flash
FROM ${NODE_IMAGE} AS m-gemini-3.8-flash
WORKDIR /src
COPY gemini-3.8-flash/package.json gemini-3.8-flash/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY gemini-3.8-flash/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5103  deepseek-v4.1-flash-coreweave
FROM ${NODE_IMAGE} AS m-deepseek-v4.1-flash-coreweave
WORKDIR /src
COPY deepseek-v4.1-flash-coreweave/package.json deepseek-v4.1-flash-coreweave/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY deepseek-v4.1-flash-coreweave/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5104  deepseek-v4.1-flash-freebuff
FROM ${NODE_IMAGE} AS m-deepseek-v4.1-flash-freebuff
WORKDIR /src
COPY deepseek-v4.1-flash-freebuff/package.json deepseek-v4.1-flash-freebuff/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY deepseek-v4.1-flash-freebuff/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5105  deepseek-v4-flash-0731-coreweave
FROM ${NODE_IMAGE} AS m-deepseek-v4-flash-0731-coreweave
WORKDIR /src
COPY deepseek-v4-flash-0731-coreweave/package.json deepseek-v4-flash-0731-coreweave/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY deepseek-v4-flash-0731-coreweave/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5106  glm-5.2-coreweave
FROM ${NODE_IMAGE} AS m-glm-5.2-coreweave
WORKDIR /src
COPY glm-5.2-coreweave/package.json glm-5.2-coreweave/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY glm-5.2-coreweave/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5107  glm-5.3-flash-coreweave
FROM ${NODE_IMAGE} AS m-glm-5.3-flash-coreweave
WORKDIR /src
COPY glm-5.3-flash-coreweave/package.json glm-5.3-flash-coreweave/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY glm-5.3-flash-coreweave/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5108  glm-5.3-flash-freebuff
FROM ${NODE_IMAGE} AS m-glm-5.3-flash-freebuff
WORKDIR /src
COPY glm-5.3-flash-freebuff/package.json glm-5.3-flash-freebuff/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY glm-5.3-flash-freebuff/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5109  mimo-v2.6-flash
FROM ${NODE_IMAGE} AS m-mimo-v2.6-flash
WORKDIR /src
COPY mimo-v2.6-flash/package.json mimo-v2.6-flash/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY mimo-v2.6-flash/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5110  muse-spark-1.3-opencode
FROM ${NODE_IMAGE} AS m-muse-spark-1.3-opencode
WORKDIR /src
COPY muse-spark-1.3-opencode/package.json muse-spark-1.3-opencode/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY muse-spark-1.3-opencode/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5111  claude-sonnet-4.6-antigravity
FROM ${NODE_IMAGE} AS m-claude-sonnet-4.6-antigravity
WORKDIR /src
COPY claude-sonnet-4.6-antigravity/package.json claude-sonnet-4.6-antigravity/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY claude-sonnet-4.6-antigravity/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5112  claude-opus-4.6-antigravity
FROM ${NODE_IMAGE} AS m-claude-opus-4.6-antigravity
WORKDIR /src
COPY claude-opus-4.6-antigravity/package.json claude-opus-4.6-antigravity/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY claude-opus-4.6-antigravity/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5113  gpt-6-luna-codex
FROM ${NODE_IMAGE} AS m-gpt-6-luna-codex
WORKDIR /src
COPY gpt-6-luna-codex/package.json gpt-6-luna-codex/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY gpt-6-luna-codex/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5114  gpt-5.6-luna-codex
FROM ${NODE_IMAGE} AS m-gpt-5.6-luna-codex
WORKDIR /src
COPY gpt-5.6-luna-codex/package.json gpt-5.6-luna-codex/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY gpt-5.6-luna-codex/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5115  opus-5.5-cursor
FROM ${NODE_IMAGE} AS m-opus-5.5-cursor
WORKDIR /src
COPY opus-5.5-cursor/package.json opus-5.5-cursor/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY opus-5.5-cursor/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5116  grok-4.7-cursor
FROM ${NODE_IMAGE} AS m-grok-4.7-cursor
WORKDIR /src
COPY grok-4.7-cursor/package.json grok-4.7-cursor/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY grok-4.7-cursor/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5117  space-bunny-cline
FROM ${NODE_IMAGE} AS m-space-bunny-cline
WORKDIR /src
COPY space-bunny-cline/package.json space-bunny-cline/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY space-bunny-cline/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5118  longcat-2.5-opencode
FROM ${NODE_IMAGE} AS m-longcat-2.5-opencode
WORKDIR /src
COPY longcat-2.5-opencode/package.json longcat-2.5-opencode/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY longcat-2.5-opencode/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/

FROM ${NODE_IMAGE} AS m-gpt-6.1-sol-codex
WORKDIR /src
COPY gpt-6.1-sol-codex/package.json gpt-6.1-sol-codex/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY gpt-6.1-sol-codex/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5120  gpt-6-astra-codex
FROM ${NODE_IMAGE} AS m-gpt-6-astra-codex
WORKDIR /src
COPY gpt-6-astra-codex/package.json gpt-6-astra-codex/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY gpt-6-astra-codex/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5121  glm-5.3-flash-zcode
FROM ${NODE_IMAGE} AS m-glm-5.3-flash-zcode
WORKDIR /src
COPY glm-5.3-flash-zcode/package.json glm-5.3-flash-zcode/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY glm-5.3-flash-zcode/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5122  ling-3.1-flash-opencode
FROM ${NODE_IMAGE} AS m-ling-3.1-flash-opencode
WORKDIR /src
COPY ling-3.1-flash-opencode/package.json ling-3.1-flash-opencode/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY ling-3.1-flash-opencode/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5123  fledge-alpha-opencode
FROM ${NODE_IMAGE} AS m-fledge-alpha-opencode
WORKDIR /src
COPY fledge-alpha-opencode/package.json fledge-alpha-opencode/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY fledge-alpha-opencode/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5124  claude-haiku-5.5-claude
FROM ${NODE_IMAGE} AS m-claude-haiku-5.5-claude
WORKDIR /src
COPY claude-haiku-5.5-claude/package.json claude-haiku-5.5-claude/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY claude-haiku-5.5-claude/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5125  claude-sonnet-5.5-claude
FROM ${NODE_IMAGE} AS m-claude-sonnet-5.5-claude
WORKDIR /src
COPY claude-sonnet-5.5-claude/package.json claude-sonnet-5.5-claude/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY claude-sonnet-5.5-claude/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5126  claude-opus-5.5-claude
FROM ${NODE_IMAGE} AS m-claude-opus-5.5-claude
WORKDIR /src
COPY claude-opus-5.5-claude/package.json claude-opus-5.5-claude/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY claude-opus-5.5-claude/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5127  kimi-k3-workbuddy
FROM ${NODE_IMAGE} AS m-kimi-k3-workbuddy
WORKDIR /src
COPY kimi-k3-workbuddy/package.json kimi-k3-workbuddy/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY kimi-k3-workbuddy/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5128  gemini-4-argon-antigravity
FROM ${NODE_IMAGE} AS m-gemini-4-argon-antigravity
WORKDIR /src
COPY gemini-4-argon-antigravity/package.json gemini-4-argon-antigravity/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY gemini-4-argon-antigravity/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5129  glm-5.3-codebuddy
FROM ${NODE_IMAGE} AS m-glm-5.3-codebuddy
WORKDIR /src
COPY GLM-5.3-Codebuddy/package.json GLM-5.3-Codebuddy/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY GLM-5.3-Codebuddy/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5130  kimi-k2.8-codebuddy
FROM ${NODE_IMAGE} AS m-kimi-k2.8-codebuddy
WORKDIR /src
COPY Kimi-K2.8-Codebuddy/package.json Kimi-K2.8-Codebuddy/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY Kimi-K2.8-Codebuddy/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/
# 5131  deepseek-v4.1-flash-1017-dsh
FROM ${NODE_IMAGE} AS m-deepseek-v4.1-flash-1017-dsh
WORKDIR /src
COPY deepseek-v4.1-flash-1017-dsh/package.json deepseek-v4.1-flash-1017-dsh/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY deepseek-v4.1-flash-1017-dsh/ ./
RUN npm run build \
 && rm -rf /out && mkdir -p /out && cp -a dist/. /out/

# ==============================================================================
# Stage: supervisord program per model, straight from models.json
# ==============================================================================
FROM ${NODE_IMAGE} AS conf
COPY aggregator/models.json /src/aggregator/models.json
COPY docker/gen-models-conf.mjs /gen-models-conf.mjs
RUN node /gen-models-conf.mjs /src/aggregator/models.json /out/models.conf


# ==============================================================================
# Runtime: Caddy routes, one static server per model, all under supervisord
# ==============================================================================
FROM ${CADDY_IMAGE}

# supervisor 4.x runs the processes; busybox-extras supplies /usr/sbin/httpd,
# which the base alpine busybox does not ship.
RUN apk add --no-cache supervisor busybox-extras

COPY --from=conf /out/models.conf /etc/supervisor.d/models.conf
COPY --from=m-gemini-3.7-flash /out /srv/models/gemini-3.7-flash
COPY --from=m-gemini-3.8-flash /out /srv/models/gemini-3.8-flash
COPY --from=m-deepseek-v4.1-flash-coreweave /out /srv/models/deepseek-v4.1-flash-coreweave
COPY --from=m-deepseek-v4.1-flash-freebuff /out /srv/models/deepseek-v4.1-flash-freebuff
COPY --from=m-deepseek-v4-flash-0731-coreweave /out /srv/models/deepseek-v4-flash-0731-coreweave
COPY --from=m-glm-5.2-coreweave /out /srv/models/glm-5.2-coreweave
COPY --from=m-glm-5.3-flash-coreweave /out /srv/models/glm-5.3-flash-coreweave
COPY --from=m-glm-5.3-flash-freebuff /out /srv/models/glm-5.3-flash-freebuff
COPY --from=m-mimo-v2.6-flash /out /srv/models/mimo-v2.6-flash
COPY --from=m-muse-spark-1.3-opencode /out /srv/models/muse-spark-1.3-opencode
COPY --from=m-claude-sonnet-4.6-antigravity /out /srv/models/claude-sonnet-4.6-antigravity
COPY --from=m-claude-opus-4.6-antigravity /out /srv/models/claude-opus-4.6-antigravity
COPY --from=m-gpt-6-luna-codex /out /srv/models/gpt-6-luna-codex
COPY --from=m-gpt-5.6-luna-codex /out /srv/models/gpt-5.6-luna-codex
COPY --from=m-opus-5.5-cursor /out /srv/models/opus-5.5-cursor
COPY --from=m-grok-4.7-cursor /out /srv/models/grok-4.7-cursor
COPY --from=m-space-bunny-cline /out /srv/models/space-bunny-cline
COPY --from=m-longcat-2.5-opencode /out /srv/models/longcat-2.5-opencode
COPY --from=m-gpt-6.1-sol-codex /out /srv/models/gpt-6.1-sol-codex
COPY --from=m-gpt-6-astra-codex /out /srv/models/gpt-6-astra-codex
COPY --from=m-glm-5.3-flash-zcode /out /srv/models/glm-5.3-flash-zcode
COPY --from=m-ling-3.1-flash-opencode /out /srv/models/ling-3.1-flash-opencode
COPY --from=m-fledge-alpha-opencode /out /srv/models/fledge-alpha-opencode
COPY --from=m-claude-haiku-5.5-claude /out /srv/models/claude-haiku-5.5-claude
COPY --from=m-claude-sonnet-5.5-claude /out /srv/models/claude-sonnet-5.5-claude
COPY --from=m-claude-opus-5.5-claude /out /srv/models/claude-opus-5.5-claude
COPY --from=m-kimi-k3-workbuddy /out /srv/models/kimi-k3-workbuddy
COPY --from=m-gemini-4-argon-antigravity /out /srv/models/gemini-4-argon-antigravity
COPY --from=m-glm-5.3-codebuddy /out /srv/models/glm-5.3-codebuddy
COPY --from=m-kimi-k2.8-codebuddy /out /srv/models/kimi-k2.8-codebuddy
COPY --from=m-deepseek-v4.1-flash-1017-dsh /out /srv/models/deepseek-v4.1-flash-1017-dsh

# Installed at /etc/supervisord.conf on purpose: that is the first path
# supervisorctl searches, so `supervisorctl status` inside the container works
# without arguments. Alpine ships its own /etc/supervisord.conf pointing at
# /run/supervisord.sock, and it would win otherwise.
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/Caddyfile /etc/caddy/Caddyfile

# Also mounted over /srv/aggregator by docker-compose.yml during development, so
# dashboard edits show up on refresh with no rebuild. Copied last: it changes
# most often and nothing depends on it.
COPY aggregator /srv/aggregator

# The only port that leaves the container (compose publishes 8080 -> 8080).
EXPOSE 8080

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
