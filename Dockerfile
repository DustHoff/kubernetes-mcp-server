# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Builder
# Install *all* dependencies but skip postinstall scripts so that dev-tool
# native binaries (rollup, esbuild, …) are never downloaded.
# Pure-JS packages like `typescript` and `@modelcontextprotocol/sdk` work
# correctly without postinstall scripts.
# ─────────────────────────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

# --ignore-scripts: prevents native-binary downloads from dev deps during
# cross-platform (ARM64) builds. TypeScript itself needs no native binaries.
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript using the locally installed binary
RUN node_modules/.bin/tsc

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Production dependencies
# Fresh `npm ci --omit=dev` on the *target* platform so npm picks the correct
# platform-native optional packages (none needed here, but future-proof).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – Final image
# Minimal attack surface: non-root user, read-only root FS compatible.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN addgroup -S mcp && adduser -S mcp -G mcp

WORKDIR /app

COPY --from=deps  --chown=mcp:mcp /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:mcp /app/dist        ./dist
COPY --chown=mcp:mcp package.json ./

USER mcp

ENV NODE_ENV=production
# Default to stdio transport; set MCP_TRANSPORT=http for network deployments.
ENV MCP_TRANSPORT=stdio
ENV MCP_PORT=3000

# Port 3000 is used when MCP_TRANSPORT=http.
EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
