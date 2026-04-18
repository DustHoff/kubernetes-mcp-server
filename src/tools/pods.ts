import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { coreV1Api } from "../k8s/client.js";

// ── list_pods ────────────────────────────────────────────────────────────────

const ListPodsArgsSchema = z.object({
  namespace: z.string().optional().default("default"),
  labelSelector: z.string().optional(),
});

export const listPodsTool: Tool = {
  name: "list_pods",
  description: "List pods in a Kubernetes namespace.",
  inputSchema: {
    type: "object",
    properties: {
      namespace: {
        type: "string",
        description: "Namespace to list pods in (default: 'default')",
      },
      labelSelector: {
        type: "string",
        description: "Label selector to filter pods (e.g. 'app=nginx')",
      },
    },
  },
};

export async function handleListPods(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { namespace, labelSelector } = ListPodsArgsSchema.parse(args);

  const res = await coreV1Api.listNamespacedPod(
    namespace,
    undefined,
    undefined,
    undefined,
    undefined,
    labelSelector
  );

  const pods = res.items.map((pod) => ({
    name: pod.metadata?.name,
    namespace: pod.metadata?.namespace,
    phase: pod.status?.phase,
    podIP: pod.status?.podIP,
    nodeName: pod.spec?.nodeName,
    ready: pod.status?.conditions?.find((c) => c.type === "Ready")?.status,
    restarts: pod.status?.containerStatuses?.[0]?.restartCount ?? 0,
    createdAt: pod.metadata?.creationTimestamp,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(pods, null, 2),
      },
    ],
  };
}

// ── get_pod_logs ─────────────────────────────────────────────────────────────

const GetPodLogsArgsSchema = z.object({
  name: z.string(),
  namespace: z.string().optional().default("default"),
  container: z.string().optional(),
  tailLines: z.number().int().positive().optional().default(100),
  previous: z.boolean().optional().default(false),
});

export const getPodLogsTool: Tool = {
  name: "get_pod_logs",
  description: "Retrieve logs from a pod container.",
  inputSchema: {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        description: "Name of the pod",
      },
      namespace: {
        type: "string",
        description: "Namespace of the pod (default: 'default')",
      },
      container: {
        type: "string",
        description:
          "Container name (required if the pod has more than one container)",
      },
      tailLines: {
        type: "number",
        description: "Number of lines to return from the end of the log (default: 100)",
      },
      previous: {
        type: "boolean",
        description: "Return logs from a previously terminated container instance",
      },
    },
  },
};

export async function handleGetPodLogs(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { name, namespace, container, tailLines, previous } =
    GetPodLogsArgsSchema.parse(args);

  const logs = await coreV1Api.readNamespacedPodLog(
    name,
    namespace,
    container,
    undefined,
    undefined,
    undefined,
    undefined,
    previous,
    undefined,
    tailLines
  );

  return {
    content: [
      {
        type: "text",
        text: typeof logs === "string" ? logs : JSON.stringify(logs),
      },
    ],
  };
}
