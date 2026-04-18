import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTextContent } from "./helpers.js";

vi.mock("../../k8s/client.js", () => ({
  coreV1Api: { listNamespace: vi.fn() },
  appsV1Api: {},
}));

import { coreV1Api } from "../../k8s/client.js";
import { handleListNamespaces } from "../namespaces.js";

const mockListNamespace = vi.mocked(coreV1Api.listNamespace);

describe("handleListNamespaces", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a formatted list of namespaces", async () => {
    mockListNamespace.mockResolvedValueOnce({
      body: {
        items: [
          {
            metadata: { name: "default", creationTimestamp: new Date("2024-01-01"), labels: { environment: "prod" } },
            status: { phase: "Active" },
          },
          {
            metadata: { name: "kube-system", creationTimestamp: new Date("2024-01-01"), labels: {} },
            status: { phase: "Active" },
          },
        ],
      },
    } as any);

    const result = await handleListNamespaces();
    const parsed = JSON.parse(getTextContent(result));

    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("default");
    expect(parsed[0].status).toBe("Active");
    expect(parsed[0].labels).toEqual({ environment: "prod" });
    expect(parsed[1].name).toBe("kube-system");
  });

  it("returns an empty list when no namespaces exist", async () => {
    mockListNamespace.mockResolvedValueOnce({ body: { items: [] } } as any);

    const result = await handleListNamespaces();
    const parsed = JSON.parse(getTextContent(result));

    expect(parsed).toHaveLength(0);
  });

  it("propagates API errors", async () => {
    mockListNamespace.mockRejectedValueOnce(new Error("API unavailable"));

    await expect(handleListNamespaces()).rejects.toThrow("API unavailable");
  });
});
