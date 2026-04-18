# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune to production-only dependencies
RUN npm ci --omit=dev

# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:22-alpine AS production

# Least-privilege user
RUN addgroup -S mcp && adduser -S mcp -G mcp

WORKDIR /app

# Copy only what is needed at runtime
COPY --from=builder --chown=mcp:mcp /app/dist ./dist
COPY --from=builder --chown=mcp:mcp /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:mcp /app/package.json ./package.json

USER mcp

# MCP servers communicate over stdio — no exposed port needed.
# Set NODE_ENV for any runtime optimisations.
ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/index.js"]
