import { Resource, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Registry of all available resources.
 * Add new resources here as they are implemented.
 */
export const resources: Resource[] = [
  {
    uri: "k8s://server/info",
    name: "Server Info",
    description: "Basic information about this MCP server",
    mimeType: "application/json",
  },
];

/**
 * Dispatches resource reads to the appropriate handler.
 */
export async function readResource(uri: string): Promise<ReadResourceResult> {
  switch (uri) {
    case "k8s://server/info":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                name: "kubernetes-mcp-server",
                version: "0.1.0",
                description: "MCP Server for Kubernetes management",
                status: "running",
              },
              null,
              2
            ),
          },
        ],
      };

    default:
      throw new Error(`Resource not found: "${uri}"`);
  }
}
