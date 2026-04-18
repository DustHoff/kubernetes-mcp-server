import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { listNamespacesTool, handleListNamespaces } from "./namespaces.js";
import { listPodsTool, handleListPods, getPodLogsTool, handleGetPodLogs } from "./pods.js";
import {
  listDeploymentsTool,
  handleListDeployments,
  scaleDeploymentTool,
  handleScaleDeployment,
} from "./deployments.js";
import { listServicesTool, handleListServices } from "./services.js";

/**
 * All tools exposed by this MCP server.
 */
export const tools: Tool[] = [
  listNamespacesTool,
  listPodsTool,
  getPodLogsTool,
  listDeploymentsTool,
  scaleDeploymentTool,
  listServicesTool,
];

/**
 * Dispatches a tool call to the matching handler.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  switch (name) {
    case "list_namespaces":
      return handleListNamespaces();
    case "list_pods":
      return handleListPods(args);
    case "get_pod_logs":
      return handleGetPodLogs(args);
    case "list_deployments":
      return handleListDeployments(args);
    case "scale_deployment":
      return handleScaleDeployment(args);
    case "list_services":
      return handleListServices(args);
    default:
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: "${name}"` }],
      };
  }
}
