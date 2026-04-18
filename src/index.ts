#!/usr/bin/env node

import http from "node:http";
import { randomUUID } from "node:crypto";
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

const accessLogEnabled =
  process.env.ACCESS_LOG === undefined ||
  (process.env.ACCESS_LOG.toLowerCase() !== "false" && process.env.ACCESS_LOG !== "0");

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

function startAccessLog(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (!accessLogEnabled) return;
  const startMs = Date.now();
  const url = new URL(req.url ?? "/", "http://localhost");
  const query = Object.fromEntries(url.searchParams);

  logger.debug("http request", {
    method: req.method,
    path: url.pathname,
    ...(Object.keys(query).length > 0 && { query }),
    ...(req.headers["content-type"] && { contentType: req.headers["content-type"] }),
    ...(req.headers["accept"] && { accept: req.headers["accept"] }),
  });

  res.on("finish", () => {
    logger.info("http access", {
      method: req.method,
      path: url.pathname,
      status: res.statusCode,
      ms: Date.now() - startMs,
    });
  });
}

async function handleHttpRequest(
  transport: { handleRequest(req: http.IncomingMessage, res: http.ServerResponse, body?: unknown): Promise<void> },
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  startAccessLog(req, res);
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/mcp") {
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", resolve);
        req.on("error", reject);
      });
      const rawBody = Buffer.concat(chunks).toString();

      let parsed: unknown;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : undefined;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }

      logger.debug("http request body", { path: url.pathname, body: parsed });

      await transport.handleRequest(req, res, parsed);
    } else if (req.method === "GET" || req.method === "DELETE") {
      await transport.handleRequest(req, res);
    } else {
      res.writeHead(405);
      res.end("Method Not Allowed");
    }
  } else if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
}

async function startHttp(): Promise<void> {
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );

  const port = parseInt(process.env.MCP_PORT ?? "3000", 10);

  // Session tracking: each initialize request gets a unique session ID, required for SSE streaming.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  const server = createServer();
  await server.connect(transport);

  const httpServer = http.createServer((req, res) => {
    handleHttpRequest(transport, req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("unhandled error in request handler", { method: req.method, url: req.url, error: message });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  });

  httpServer.on("error", (err) => {
    logger.error("http server error", { error: err.message });
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
