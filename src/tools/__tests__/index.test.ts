import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTextContent } from "./helpers.js";

vi.mock("../../k8s/client.js", () => ({
  coreV1Api: {
    listNamespace: vi.fn(),
    listNamespacedPod: vi.fn(),
    readNamespacedPodLog: vi.fn(),
    listNamespacedService: vi.fn(),
  },
  appsV1Api: {
    listNamespacedDeployment: vi.fn(),
    patchNamespacedDeploymentScale: vi.fn(),
  },
}));

import { tools, handleToolCall } from "../index.js";
import { coreV1Api } from "../../k8s/client.js";
import { appsV1Api } from "../../k8s/client.js";

describe("Tool registry", () => {
  it("exports all expected tools", () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_namespaces");
    expect(names).toContain("list_pods");
    expect(names).toContain("get_pod_logs");
    expect(names).toContain("list_deployments");
    expect(names).toContain("scale_deployment");
    expect(names).toContain("list_services");
  });

  it("every tool has a name, description and inputSchema", () => {
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });
});

describe("handleToolCall dispatcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns isError for unknown tools", async () => {
    const result = await handleToolCall("unknown_tool", {});

    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toContain("unknown_tool");
  });

  it("dispatches list_namespaces correctly", async () => {
    vi.mocked(coreV1Api.listNamespace).mockResolvedValueOnce({
      body: { items: [] },
    } as any);

    const result = await handleToolCall("list_namespaces", {});
    expect(result.isError).toBeUndefined();
  });

  it("dispatches list_pods correctly", async () => {
    vi.mocked(coreV1Api.listNamespacedPod).mockResolvedValueOnce({
      body: { items: [] },
    } as any);

    const result = await handleToolCall("list_pods", { namespace: "default" });
    expect(result.isError).toBeUndefined();
  });

  it("dispatches scale_deployment correctly", async () => {
    vi.mocked(appsV1Api.patchNamespacedDeploymentScale).mockResolvedValueOnce({} as any);

    const result = await handleToolCall("scale_deployment", { name: "my-app", replicas: 3 });

    expect(result.isError).toBeUndefined();
    expect(getTextContent(result)).toContain("3 replica(s)");
  });
});
