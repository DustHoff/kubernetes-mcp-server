#!/usr/bin/env node

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

const SERVER_NAME = "kubernetes-mcp-server";
const SERVER_VERSION = "0.1.0";

/**
 * Kubernetes MCP Server
 *
 * Provides tools and resources for Kubernetes cluster management
 * via the Model Context Protocol (MCP).
 */
async function main(): Promise<void> {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // --- Tool Handlers ---
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {});
  });

  // --- Resource Handlers ---
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    return readResource(uri);
  });

  // --- Transport ---
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
