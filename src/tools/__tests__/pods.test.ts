import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTextContent } from "./helpers.js";

vi.mock("../../k8s/client.js", () => ({
  coreV1Api: {
    listNamespacedPod: vi.fn(),
    readNamespacedPodLog: vi.fn(),
  },
  appsV1Api: {},
}));

import { coreV1Api } from "../../k8s/client.js";
import { handleListPods, handleGetPodLogs } from "../pods.js";

const mockListPods = vi.mocked(coreV1Api.listNamespacedPod);
const mockGetLogs = vi.mocked(coreV1Api.readNamespacedPodLog);

function makePod(name: string, phase = "Running", restarts = 0) {
  return {
    metadata: { name, namespace: "default", creationTimestamp: new Date("2024-06-01") },
    spec: { nodeName: "node-1" },
    status: {
      phase,
      podIP: "10.0.0.1",
      conditions: [{ type: "Ready", status: "True" }],
      containerStatuses: [{ restartCount: restarts }],
    },
  };
}

// ── list_pods ────────────────────────────────────────────────────────────────

describe("handleListPods", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists pods in the default namespace", async () => {
    mockListPods.mockResolvedValueOnce({
      body: { items: [makePod("nginx-abc"), makePod("redis-xyz")] },
    } as any);

    const result = await handleListPods({});
    const pods = JSON.parse(getTextContent(result));

    expect(pods).toHaveLength(2);
    expect(pods[0].name).toBe("nginx-abc");
    expect(pods[0].phase).toBe("Running");
    expect(pods[0].ready).toBe("True");
    expect(pods[0].restarts).toBe(0);
  });

  it("passes namespace and labelSelector to the API", async () => {
    mockListPods.mockResolvedValueOnce({ body: { items: [] } } as any);

    await handleListPods({ namespace: "production", labelSelector: "app=api" });

    expect(mockListPods).toHaveBeenCalledWith(
      "production", undefined, undefined, undefined, undefined, "app=api"
    );
  });

  it("defaults to namespace 'default' when not provided", async () => {
    mockListPods.mockResolvedValueOnce({ body: { items: [] } } as any);

    await handleListPods({});

    expect(mockListPods).toHaveBeenCalledWith(
      "default", undefined, undefined, undefined, undefined, undefined
    );
  });

  it("shows non-zero restart count", async () => {
    mockListPods.mockResolvedValueOnce({
      body: { items: [makePod("crashloop-pod", "CrashLoopBackOff", 5)] },
    } as any);

    const result = await handleListPods({});
    const pods = JSON.parse(getTextContent(result));

    expect(pods[0].restarts).toBe(5);
    expect(pods[0].phase).toBe("CrashLoopBackOff");
  });
});

// ── get_pod_logs ─────────────────────────────────────────────────────────────

describe("handleGetPodLogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns log content as text", async () => {
    mockGetLogs.mockResolvedValueOnce({
      body: "2024-01-01 INFO Server started\n2024-01-01 INFO Listening on :8080",
    } as any);

    const result = await handleGetPodLogs({ name: "my-pod" });

    expect(getTextContent(result)).toContain("Server started");
    expect(getTextContent(result)).toContain("Listening on :8080");
  });

  it("passes all parameters to the API correctly", async () => {
    mockGetLogs.mockResolvedValueOnce({ body: "" } as any);

    await handleGetPodLogs({
      name: "my-pod",
      namespace: "staging",
      container: "app",
      tailLines: 50,
      previous: true,
    });

    expect(mockGetLogs).toHaveBeenCalledWith(
      "my-pod", "staging", "app",
      undefined, undefined, undefined, undefined,
      true, undefined, 50
    );
  });

  it("requires the name argument", async () => {
    await expect(handleGetPodLogs({})).rejects.toThrow();
  });
});
