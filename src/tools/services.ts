import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { coreV1Api } from "../k8s/client.js";

const ListServicesArgsSchema = z.object({
  namespace: z.string().optional().default("default"),
  labelSelector: z.string().optional(),
});

export const listServicesTool: Tool = {
  name: "list_services",
  description: "List Services in a Kubernetes namespace.",
  inputSchema: {
    type: "object",
    properties: {
      namespace: {
        type: "string",
        description: "Namespace to list services in (default: 'default')",
      },
      labelSelector: {
        type: "string",
        description: "Label selector to filter services (e.g. 'app=nginx')",
      },
    },
  },
};

export async function handleListServices(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { namespace, labelSelector } = ListServicesArgsSchema.parse(args);

  const res = await coreV1Api.listNamespacedService(
    namespace,
    undefined,
    undefined,
    undefined,
    undefined,
    labelSelector
  );

  const services = res.items.map((svc) => ({
    name: svc.metadata?.name,
    namespace: svc.metadata?.namespace,
    type: svc.spec?.type,
    clusterIP: svc.spec?.clusterIP,
    externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip ?? null,
    ports: svc.spec?.ports?.map((p) => ({
      name: p.name,
      port: p.port,
      targetPort: p.targetPort,
      protocol: p.protocol,
    })),
    selector: svc.spec?.selector ?? {},
    createdAt: svc.metadata?.creationTimestamp,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(services, null, 2),
      },
    ],
  };
}
