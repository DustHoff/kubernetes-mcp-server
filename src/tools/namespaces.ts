import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { coreV1Api } from "../k8s/client.js";

export const listNamespacesTool: Tool = {
  name: "list_namespaces",
  description: "List all namespaces in the Kubernetes cluster.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleListNamespaces(): Promise<CallToolResult> {
  const res = await coreV1Api.listNamespace();
  const namespaces = res.items.map((ns) => ({
    name: ns.metadata?.name,
    status: ns.status?.phase,
    createdAt: ns.metadata?.creationTimestamp,
    labels: ns.metadata?.labels ?? {},
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(namespaces, null, 2),
      },
    ],
  };
}
