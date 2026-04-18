#!/usr/bin/env node

import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { tools, handleToolCall } from "./tools/index.js";
import { resources, readResource } from "./resources/index.js";
import { logger } from "./logger.js";
import { runSelfCheck } from "./k8s/selfcheck.js";

const SERVER_NAME = "kubernetes-mcp-server";
const SERVER_VERSION = "0.1.0";

function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {});
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    return readResource(uri);
  });

  return server;
}

async function startStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("server started", { name: SERVER_NAME, version: SERVER_VERSION, transport: "stdio" });
  await runSelfCheck();
}

async function startHttp(): Promise<void> {
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );

  const port = parseInt(process.env.MCP_PORT ?? "3000", 10);

  // Stateless mode: each POST is handled independently; no session tracking needed.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);

  const httpServer = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

    if (pathname === "/mcp") {
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = Buffer.concat(chunks).toString();
            const parsed = body ? JSON.parse(body) : undefined;
            await transport.handleRequest(req, res, parsed);
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
          }
        });
      } else if (req.method === "GET" || req.method === "DELETE") {
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(405);
        res.end("Method Not Allowed");
      }
    } else if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  httpServer.listen(port, () => {
    logger.info("server started", { name: SERVER_NAME, version: SERVER_VERSION, transport: "http", port });
    void runSelfCheck();
  });
}

const mode = process.env.MCP_TRANSPORT ?? "stdio";

if (mode === "http") {
  startHttp().catch((error: unknown) => {
    logger.error("fatal error", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
} else {
  startStdio().catch((error: unknown) => {
    logger.error("fatal error", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}
