import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTextContent } from "./helpers.js";

vi.mock("../../k8s/client.js", () => ({
  coreV1Api: {},
  appsV1Api: {
    listNamespacedDeployment: vi.fn(),
    patchNamespacedDeploymentScale: vi.fn(),
  },
}));

import { appsV1Api } from "../../k8s/client.js";
import { handleListDeployments, handleScaleDeployment } from "../deployments.js";

const mockList = vi.mocked(appsV1Api.listNamespacedDeployment);
const mockScale = vi.mocked(appsV1Api.patchNamespacedDeploymentScale);

function makeDeployment(name: string, replicas = 3, ready = 3) {
  return {
    metadata: {
      name, namespace: "default",
      creationTimestamp: new Date("2024-06-01"),
      labels: { app: name },
    },
    spec: {
      replicas,
      template: { spec: { containers: [{ image: `registry/${name}:latest` }] } },
    },
    status: { readyReplicas: ready, availableReplicas: ready, updatedReplicas: replicas },
  };
}

// ── list_deployments ─────────────────────────────────────────────────────────

describe("handleListDeployments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns formatted deployment list", async () => {
    mockList.mockResolvedValueOnce({
      body: { items: [makeDeployment("api-server", 3, 3), makeDeployment("worker", 2, 1)] },
    } as any);

    const result = await handleListDeployments({});
    const deployments = JSON.parse(getTextContent(result));

    expect(deployments).toHaveLength(2);
    expect(deployments[0].name).toBe("api-server");
    expect(deployments[0].replicas).toBe(3);
    expect(deployments[0].readyReplicas).toBe(3);
    expect(deployments[1].name).toBe("worker");
    expect(deployments[1].readyReplicas).toBe(1);
  });

  it("passes labelSelector to the API", async () => {
    mockList.mockResolvedValueOnce({ body: { items: [] } } as any);

    await handleListDeployments({ namespace: "production", labelSelector: "tier=backend" });

    expect(mockList).toHaveBeenCalledWith(
      "production", undefined, undefined, undefined, undefined, "tier=backend"
    );
  });

  it("returns empty list when no deployments exist", async () => {
    mockList.mockResolvedValueOnce({ body: { items: [] } } as any);

    const result = await handleListDeployments({});
    const deployments = JSON.parse(getTextContent(result));

    expect(deployments).toHaveLength(0);
  });
});

// ── scale_deployment ─────────────────────────────────────────────────────────

describe("handleScaleDeployment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scales deployment and returns confirmation message", async () => {
    mockScale.mockResolvedValueOnce({} as any);

    const result = await handleScaleDeployment({ name: "api-server", namespace: "default", replicas: 5 });

    expect(getTextContent(result)).toContain("api-server");
    expect(getTextContent(result)).toContain("5 replica(s)");
  });

  it("calls the API with correct parameters including fieldValidation slot", async () => {
    mockScale.mockResolvedValueOnce({} as any);

    await handleScaleDeployment({ name: "worker", namespace: "staging", replicas: 2 });

    expect(mockScale).toHaveBeenCalledWith(
      "worker", "staging", { spec: { replicas: 2 } },
      undefined, undefined, undefined, undefined, undefined,
      { headers: { "Content-Type": "application/merge-patch+json" } }
    );
  });

  it("can scale a deployment to zero", async () => {
    mockScale.mockResolvedValueOnce({} as any);

    const result = await handleScaleDeployment({ name: "worker", replicas: 0 });

    expect(getTextContent(result)).toContain("0 replica(s)");
  });

  it("rejects negative replica counts", async () => {
    await expect(handleScaleDeployment({ name: "api", replicas: -1 })).rejects.toThrow();
  });

  it("requires name and replicas arguments", async () => {
    await expect(handleScaleDeployment({})).rejects.toThrow();
    await expect(handleScaleDeployment({ name: "api" })).rejects.toThrow();
  });
});
