import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { appsV1Api } from "../k8s/client.js";
import { k8sAudit } from "../k8s/audit.js";

// ── list_deployments ─────────────────────────────────────────────────────────

const ListDeploymentsArgsSchema = z.object({
  namespace: z.string().optional().default("default"),
  labelSelector: z.string().optional(),
});

export const listDeploymentsTool: Tool = {
  name: "list_deployments",
  description: "List Deployments in a Kubernetes namespace.",
  inputSchema: {
    type: "object",
    properties: {
      namespace: {
        type: "string",
        description: "Namespace to list deployments in (default: 'default')",
      },
      labelSelector: {
        type: "string",
        description: "Label selector to filter deployments (e.g. 'app=nginx')",
      },
    },
  },
};

export async function handleListDeployments(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { namespace, labelSelector } = ListDeploymentsArgsSchema.parse(args);

  // v0.x positional params:
  // listNamespacedDeployment(namespace, pretty, allowWatchBookmarks, _continue,
  //                          fieldSelector, labelSelector, ...)
  const res = await k8sAudit(
    "listNamespacedDeployment",
    { namespace, ...(labelSelector && { labelSelector }) },
    () => appsV1Api.listNamespacedDeployment(namespace, undefined, undefined, undefined, undefined, labelSelector)
  );

  const deployments = res.body.items.map((d) => ({
    name: d.metadata?.name,
    namespace: d.metadata?.namespace,
    replicas: d.spec?.replicas,
    readyReplicas: d.status?.readyReplicas ?? 0,
    availableReplicas: d.status?.availableReplicas ?? 0,
    updatedReplicas: d.status?.updatedReplicas ?? 0,
    image: d.spec?.template.spec?.containers?.[0]?.image,
    createdAt: d.metadata?.creationTimestamp,
    labels: d.metadata?.labels ?? {},
  }));

  return {
    content: [{ type: "text", text: JSON.stringify(deployments, null, 2) }],
  };
}

// ── scale_deployment ─────────────────────────────────────────────────────────

const ScaleDeploymentArgsSchema = z.object({
  name: z.string(),
  namespace: z.string().optional().default("default"),
  replicas: z.number().int().min(0),
});

export const scaleDeploymentTool: Tool = {
  name: "scale_deployment",
  description: "Scale a Deployment to a given number of replicas.",
  inputSchema: {
    type: "object",
    required: ["name", "replicas"],
    properties: {
      name: {
        type: "string",
        description: "Name of the Deployment",
      },
      namespace: {
        type: "string",
        description: "Namespace of the Deployment (default: 'default')",
      },
      replicas: {
        type: "number",
        description: "Desired number of replicas (0 = scale to zero)",
      },
    },
  },
};

export async function handleScaleDeployment(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { name, namespace, replicas } = ScaleDeploymentArgsSchema.parse(args);

  // v0.21.x: patchNamespacedDeploymentScale(name, namespace, body,
  //   pretty, dryRun, fieldManager, fieldValidation, force, options)
  await k8sAudit(
    "patchNamespacedDeploymentScale",
    { name, namespace, replicas },
    () => appsV1Api.patchNamespacedDeploymentScale(
      name,
      namespace,
      { spec: { replicas } },
      undefined, // pretty
      undefined, // dryRun
      undefined, // fieldManager
      undefined, // fieldValidation
      undefined, // force
      { headers: { "Content-Type": "application/merge-patch+json" } }
    )
  );

  return {
    content: [
      {
        type: "text",
        text: `Deployment "${name}" in namespace "${namespace}" scaled to ${replicas} replica(s).`,
      },
    ],
  };
}
