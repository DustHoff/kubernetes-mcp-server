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
import { execInPodTool, handleExecInPod } from "./exec.js";
import {
  listResourcesTool,
  handleListResources,
  getResourceTool,
  handleGetResource,
  createResourceTool,
  handleCreateResource,
  updateResourceTool,
  handleUpdateResource,
  patchResourceTool,
  handlePatchResource,
  deleteResourceTool,
  handleDeleteResource,
} from "./resources.js";

/**
 * All tools exposed by this MCP server.
 */
export const tools: Tool[] = [
  // Specific convenience tools
  listNamespacesTool,
  listPodsTool,
  getPodLogsTool,
  execInPodTool,
  listDeploymentsTool,
  scaleDeploymentTool,
  listServicesTool,
  // Generic CRUD tools (cover all resource types)
  listResourcesTool,
  getResourceTool,
  createResourceTool,
  updateResourceTool,
  patchResourceTool,
  deleteResourceTool,
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
    case "exec_in_pod":
      return handleExecInPod(args);
    case "list_deployments":
      return handleListDeployments(args);
    case "scale_deployment":
      return handleScaleDeployment(args);
    case "list_services":
      return handleListServices(args);
    case "list_resources":
      return handleListResources(args);
    case "get_resource":
      return handleGetResource(args);
    case "create_resource":
      return handleCreateResource(args);
    case "update_resource":
      return handleUpdateResource(args);
    case "patch_resource":
      return handlePatchResource(args);
    case "delete_resource":
      return handleDeleteResource(args);
    default:
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: "${name}"` }],
      };
  }
}
