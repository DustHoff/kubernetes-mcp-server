import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { objectApi } from "../k8s/client.js";
import { k8sAudit } from "../k8s/audit.js";

// ── list_resources ────────────────────────────────────────────────────────────

const ListResourcesArgsSchema = z.object({
  kind: z.string(),
  apiVersion: z.string(),
  namespace: z.string().optional(),
  labelSelector: z.string().optional(),
  fieldSelector: z.string().optional(),
});

export const listResourcesTool: Tool = {
  name: "list_resources",
  description:
    "List Kubernetes resources of any kind (Pods, ConfigMaps, Ingresses, Jobs, …).",
  inputSchema: {
    type: "object",
    required: ["kind", "apiVersion"],
    properties: {
      kind: {
        type: "string",
        description: "Resource kind, e.g. 'Pod', 'ConfigMap', 'Ingress'",
      },
      apiVersion: {
        type: "string",
        description:
          "API version, e.g. 'v1', 'apps/v1', 'networking.k8s.io/v1'",
      },
      namespace: {
        type: "string",
        description: "Namespace to list in; omit for cluster-scoped resources",
      },
      labelSelector: {
        type: "string",
        description: "Label selector filter, e.g. 'app=nginx'",
      },
      fieldSelector: {
        type: "string",
        description: "Field selector filter, e.g. 'status.phase=Running'",
      },
    },
  },
};

export async function handleListResources(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { kind, apiVersion, namespace, labelSelector, fieldSelector } =
    ListResourcesArgsSchema.parse(args);

  const res = await k8sAudit(
    "list",
    { kind, apiVersion, ...(namespace && { namespace }), ...(labelSelector && { labelSelector }), ...(fieldSelector && { fieldSelector }) },
    () => objectApi.list(apiVersion, kind, namespace, undefined, undefined, undefined, fieldSelector, labelSelector)
  );

  return {
    content: [{ type: "text", text: JSON.stringify(res.body.items, null, 2) }],
  };
}

// ── get_resource ──────────────────────────────────────────────────────────────

const GetResourceArgsSchema = z.object({
  kind: z.string(),
  apiVersion: z.string(),
  name: z.string(),
  namespace: z.string().optional(),
});

export const getResourceTool: Tool = {
  name: "get_resource",
  description: "Get a single Kubernetes resource by kind, name, and namespace.",
  inputSchema: {
    type: "object",
    required: ["kind", "apiVersion", "name"],
    properties: {
      kind: {
        type: "string",
        description: "Resource kind, e.g. 'Deployment', 'Secret'",
      },
      apiVersion: {
        type: "string",
        description: "API version, e.g. 'v1', 'apps/v1'",
      },
      name: { type: "string", description: "Name of the resource" },
      namespace: {
        type: "string",
        description: "Namespace; omit for cluster-scoped resources",
      },
    },
  },
};

export async function handleGetResource(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { kind, apiVersion, name, namespace } =
    GetResourceArgsSchema.parse(args);

  const res = await k8sAudit(
    "read",
    { kind, apiVersion, name, ...(namespace && { namespace }) },
    () => objectApi.read({ apiVersion, kind, metadata: { name, namespace: namespace ?? "" } })
  );

  return {
    content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
  };
}

// ── create_resource ───────────────────────────────────────────────────────────

const CreateResourceArgsSchema = z.object({
  manifest: z.string(),
});

export const createResourceTool: Tool = {
  name: "create_resource",
  description:
    "Create a Kubernetes resource from a JSON manifest string. The manifest must include apiVersion, kind, and metadata.name.",
  inputSchema: {
    type: "object",
    required: ["manifest"],
    properties: {
      manifest: {
        type: "string",
        description: "Full Kubernetes manifest as a JSON string",
      },
    },
  },
};

export async function handleCreateResource(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { manifest } = CreateResourceArgsSchema.parse(args);
  const spec = JSON.parse(manifest);

  const res = await k8sAudit(
    "create",
    { kind: spec.kind as string, apiVersion: spec.apiVersion as string, name: (spec.metadata as { name?: string })?.name },
    () => objectApi.create(spec)
  );

  return {
    content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
  };
}

// ── update_resource ───────────────────────────────────────────────────────────

const UpdateResourceArgsSchema = z.object({
  manifest: z.string(),
});

export const updateResourceTool: Tool = {
  name: "update_resource",
  description:
    "Replace a Kubernetes resource with a new manifest (full update). The manifest must include apiVersion, kind, metadata.name, and metadata.resourceVersion.",
  inputSchema: {
    type: "object",
    required: ["manifest"],
    properties: {
      manifest: {
        type: "string",
        description:
          "Full Kubernetes manifest as a JSON string (must include metadata.resourceVersion)",
      },
    },
  },
};

export async function handleUpdateResource(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { manifest } = UpdateResourceArgsSchema.parse(args);
  const spec = JSON.parse(manifest);

  const res = await k8sAudit(
    "replace",
    { kind: spec.kind as string, apiVersion: spec.apiVersion as string, name: (spec.metadata as { name?: string })?.name },
    () => objectApi.replace(spec)
  );

  return {
    content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
  };
}

// ── patch_resource ────────────────────────────────────────────────────────────

const PatchResourceArgsSchema = z.object({
  kind: z.string(),
  apiVersion: z.string(),
  name: z.string(),
  namespace: z.string().optional(),
  patch: z.string(),
});

export const patchResourceTool: Tool = {
  name: "patch_resource",
  description:
    "Apply a JSON merge patch to a Kubernetes resource. Only the fields in the patch object are updated.",
  inputSchema: {
    type: "object",
    required: ["kind", "apiVersion", "name", "patch"],
    properties: {
      kind: { type: "string", description: "Resource kind, e.g. 'Deployment'" },
      apiVersion: { type: "string", description: "API version, e.g. 'apps/v1'" },
      name: { type: "string", description: "Name of the resource" },
      namespace: {
        type: "string",
        description: "Namespace; omit for cluster-scoped resources",
      },
      patch: {
        type: "string",
        description:
          "JSON merge patch as a string, e.g. '{\"spec\":{\"replicas\":3}}'",
      },
    },
  },
};

export async function handlePatchResource(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { kind, apiVersion, name, namespace, patch } =
    PatchResourceArgsSchema.parse(args);

  const spec = {
    apiVersion,
    kind,
    metadata: { name, namespace: namespace ?? "" },
    ...JSON.parse(patch),
  };

  const res = await k8sAudit(
    "patch",
    { kind, apiVersion, name, ...(namespace && { namespace }) },
    () => objectApi.patch(spec, undefined, undefined, "kubernetes-mcp", undefined, { headers: { "Content-Type": "application/merge-patch+json" } })
  );

  return {
    content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
  };
}

// ── delete_resource ───────────────────────────────────────────────────────────

const DeleteResourceArgsSchema = z.object({
  kind: z.string(),
  apiVersion: z.string(),
  name: z.string(),
  namespace: z.string().optional(),
});

export const deleteResourceTool: Tool = {
  name: "delete_resource",
  description: "Delete a Kubernetes resource by kind, name, and namespace.",
  inputSchema: {
    type: "object",
    required: ["kind", "apiVersion", "name"],
    properties: {
      kind: { type: "string", description: "Resource kind, e.g. 'Pod'" },
      apiVersion: { type: "string", description: "API version, e.g. 'v1'" },
      name: { type: "string", description: "Name of the resource" },
      namespace: {
        type: "string",
        description: "Namespace; omit for cluster-scoped resources",
      },
    },
  },
};

export async function handleDeleteResource(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { kind, apiVersion, name, namespace } =
    DeleteResourceArgsSchema.parse(args);

  await k8sAudit(
    "delete",
    { kind, apiVersion, name, ...(namespace && { namespace }) },
    () => objectApi.delete({ apiVersion, kind, metadata: { name, namespace: namespace ?? "" } })
  );

  return {
    content: [
      {
        type: "text",
        text: `${kind} "${name}"${namespace ? ` in namespace "${namespace}"` : ""} deleted.`,
      },
    ],
  };
}
