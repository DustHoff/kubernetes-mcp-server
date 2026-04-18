import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTextContent } from "./helpers.js";

vi.mock("../../k8s/client.js", () => ({
  coreV1Api: { listNamespacedService: vi.fn() },
  appsV1Api: {},
}));

import { coreV1Api } from "../../k8s/client.js";
import { handleListServices } from "../services.js";

const mockList = vi.mocked(coreV1Api.listNamespacedService);

function makeService(name: string, type = "ClusterIP", externalIP: string | null = null) {
  return {
    metadata: { name, namespace: "default", creationTimestamp: new Date("2024-06-01") },
    spec: {
      type,
      clusterIP: "10.96.0.1",
      ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
      selector: { app: name },
    },
    status: {
      loadBalancer: externalIP ? { ingress: [{ ip: externalIP }] } : {},
    },
  };
}

describe("handleListServices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a formatted list of services", async () => {
    mockList.mockResolvedValueOnce({
      body: {
        items: [
          makeService("frontend", "ClusterIP"),
          makeService("lb-service", "LoadBalancer", "203.0.113.10"),
        ],
      },
    } as any);

    const result = await handleListServices({});
    const services = JSON.parse(getTextContent(result));

    expect(services).toHaveLength(2);
    expect(services[0].name).toBe("frontend");
    expect(services[0].type).toBe("ClusterIP");
    expect(services[0].externalIP).toBeNull();
    expect(services[1].name).toBe("lb-service");
    expect(services[1].type).toBe("LoadBalancer");
    expect(services[1].externalIP).toBe("203.0.113.10");
  });

  it("includes port information", async () => {
    mockList.mockResolvedValueOnce({
      body: { items: [makeService("api")] },
    } as any);

    const result = await handleListServices({});
    const services = JSON.parse(getTextContent(result));

    expect(services[0].ports).toHaveLength(1);
    expect(services[0].ports[0].port).toBe(80);
    expect(services[0].ports[0].protocol).toBe("TCP");
  });

  it("passes namespace and labelSelector to the API", async () => {
    mockList.mockResolvedValueOnce({ body: { items: [] } } as any);

    await handleListServices({ namespace: "monitoring", labelSelector: "app=prometheus" });

    expect(mockList).toHaveBeenCalledWith(
      "monitoring", undefined, undefined, undefined, undefined, "app=prometheus"
    );
  });

  it("returns empty list when no services exist", async () => {
    mockList.mockResolvedValueOnce({ body: { items: [] } } as any);

    const result = await handleListServices({});
    const services = JSON.parse(getTextContent(result));

    expect(services).toHaveLength(0);
  });
});
