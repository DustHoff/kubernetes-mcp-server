# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode (tsc --watch)
npm start              # Run the built server (node dist/index.js)
npm run lint           # ESLint static analysis
npm run lint:fix       # Auto-fix ESLint issues
npm test               # Run all tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
```

To run a single test file:
```bash
npx vitest run src/tools/__tests__/pods.test.ts
```

## Architecture

This is a **Model Context Protocol (MCP) server** that exposes Kubernetes cluster operations as tools for LLM clients. It communicates over **stdio** (no HTTP port) and is designed to run as a pod inside a Kubernetes cluster.

### Authentication

`src/k8s/client.ts` creates a `KubeConfig` that tries in-cluster Service Account credentials first, falling back to `~/.kube/config` for local development.

### Tool Registration Flow

1. `src/index.ts` — creates `McpServer` with stdio transport, registers tools and resources
2. `src/tools/index.ts` — exports `registerTools(server, k8sClient)`, which wires all tool modules
3. `src/tools/*.ts` — each file exports a `register*Tool()` function that calls `server.tool()` with a Zod input schema and handler

### Available Tools

| Tool | File | Type |
|------|------|------|
| `list_namespaces` | `namespaces.ts` | Query |
| `list_pods` | `pods.ts` | Query |
| `get_pod_logs` | `pods.ts` | Query |
| `list_deployments` | `deployments.ts` | Query |
| `list_services` | `services.ts` | Query |
| `scale_deployment` | `deployments.ts` | Mutation |
| `exec_in_pod` | `exec.ts` | Execution |

### Adding a New Tool

1. Create or extend a file in `src/tools/`
2. Export a `register*Tool(server, k8sClient)` function
3. Call it from `src/tools/index.ts`
4. Add a corresponding test in `src/tools/__tests__/`

### Testing

Tests use **Vitest** and mock the Kubernetes client via `vi.mock()`. Test files live in `src/tools/__tests__/`. The helper `src/tools/__tests__/helpers.ts` provides shared mock utilities.

### Docker

The `Dockerfile` is a 3-stage build (builder → deps → production). The final image runs as non-root user `mcp` on `node:22-alpine`. Multi-platform images (linux/amd64 + linux/arm64) are built and pushed to `ghcr.io` only on version tags (`v*.*.*`).
