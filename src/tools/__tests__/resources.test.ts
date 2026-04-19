import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTextContent } from "./helpers.js";

vi.mock("../../k8s/client.js", () => ({
  coreV1Api: {},
  appsV1Api: {},
  objectApi: {
    list: vi.fn(),
    read: vi.fn(),
    create: vi.fn(),
    replace: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { objectApi } from "../../k8s/client.js";
import {
  handleListResources,
  handleGetResource,
  handleCreateResource,
  handleUpdateResource,
  handlePatchResource,
  handleDeleteResource,
} from "../resources.js";

const mockList = vi.mocked(objectApi.list);
const mockRead = vi.mocked(objectApi.read);
const mockCreate = vi.mocked(objectApi.create);
const mockReplace = vi.mocked(objectApi.replace);
const mockPatch = vi.mocked(objectApi.patch);
const mockDelete = vi.mocked(objectApi.delete);

function makeConfigMap(name: string, data: Record<string, string> = {}) {
  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: { name, namespace: "default", resourceVersion: "1" },
    data,
  };
}

// ── list_resources ────────────────────────────────────────────────────────────

describe("handleListResources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists resources of the given kind", async () => {
    mockList.mockResolvedValueOnce({
      body: { items: [makeConfigMap("app-config"), makeConfigMap("db-config")] },
    } as any);

    const result = await handleListResources({ kind: "ConfigMap", apiVersion: "v1" });
    const items = JSON.parse(getTextContent(result));

    expect(items).toHaveLength(2);
    expect(items[0].metadata.name).toBe("app-config");
  });

  it("passes namespace and selectors to the API", async () => {
    mockList.mockResolvedValueOnce({ body: { items: [] } } as any);

    await handleListResources({
      kind: "Pod",
      apiVersion: "v1",
      namespace: "production",
      labelSelector: "app=api",
      fieldSelector: "status.phase=Running",
    });

    expect(mockList).toHaveBeenCalledWith(
      "v1", "Pod", "production",
      undefined, undefined, undefined,
      "status.phase=Running", "app=api"
    );
  });

  it("omits namespace for cluster-scoped resources", async () => {
    mockList.mockResolvedValueOnce({ body: { items: [] } } as any);

    await handleListResources({ kind: "Namespace", apiVersion: "v1" });

    expect(mockList).toHaveBeenCalledWith(
      "v1", "Namespace", undefined,
      undefined, undefined, undefined,
      undefined, undefined
    );
  });

  it("requires kind and apiVersion", async () => {
    await expect(handleListResources({})).rejects.toThrow();
  });
});

// ── get_resource ──────────────────────────────────────────────────────────────

describe("handleGetResource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the resource as JSON", async () => {
    mockRead.mockResolvedValueOnce({
      body: makeConfigMap("my-config", { key: "value" }),
    } as any);

    const result = await handleGetResource({
      kind: "ConfigMap",
      apiVersion: "v1",
      name: "my-config",
      namespace: "default",
    });
    const item = JSON.parse(getTextContent(result));

    expect(item.metadata.name).toBe("my-config");
    expect(item.data.key).toBe("value");
  });

  it("passes the correct spec to the API", async () => {
    mockRead.mockResolvedValueOnce({ body: {} } as any);

    await handleGetResource({
      kind: "Deployment",
      apiVersion: "apps/v1",
      name: "my-app",
      namespace: "staging",
    });

    expect(mockRead).toHaveBeenCalledWith({
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: "my-app", namespace: "staging" },
    });
  });

  it("requires kind, apiVersion, and name", async () => {
    await expect(handleGetResource({ kind: "Pod" })).rejects.toThrow();
  });
});

// ── create_resource ───────────────────────────────────────────────────────────

describe("handleCreateResource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a resource from a JSON manifest string", async () => {
    const cm = makeConfigMap("new-config", { env: "prod" });
    mockCreate.mockResolvedValueOnce({ body: cm } as any);

    const result = await handleCreateResource({ manifest: JSON.stringify(cm) });
    const created = JSON.parse(getTextContent(result));

    expect(created.metadata.name).toBe("new-config");
    expect(mockCreate).toHaveBeenCalledWith(cm);
  });

  it("requires manifest", async () => {
    await expect(handleCreateResource({})).rejects.toThrow();
  });

  it("rejects invalid JSON in manifest", async () => {
    await expect(
      handleCreateResource({ manifest: "not-json" })
    ).rejects.toThrow();
  });
});

// ── update_resource ───────────────────────────────────────────────────────────

describe("handleUpdateResource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replaces a resource with the provided manifest", async () => {
    const cm = makeConfigMap("existing-config");
    mockReplace.mockResolvedValueOnce({ body: cm } as any);

    const result = await handleUpdateResource({ manifest: JSON.stringify(cm) });
    const updated = JSON.parse(getTextContent(result));

    expect(updated.metadata.name).toBe("existing-config");
    expect(mockReplace).toHaveBeenCalledWith(cm);
  });
});

// ── patch_resource ────────────────────────────────────────────────────────────

describe("handlePatchResource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("patches a resource with a JSON merge patch", async () => {
    mockPatch.mockResolvedValueOnce({
      body: { metadata: { name: "my-deploy" }, spec: { replicas: 5 } },
    } as any);

    const result = await handlePatchResource({
      kind: "Deployment",
      apiVersion: "apps/v1",
      name: "my-deploy",
      namespace: "default",
      patch: JSON.stringify({ spec: { replicas: 5 } }),
    });
    const patched = JSON.parse(getTextContent(result));

    expect(patched.spec.replicas).toBe(5);
  });

  it("sends merge-patch content type header", async () => {
    mockPatch.mockResolvedValueOnce({ body: {} } as any);

    await handlePatchResource({
      kind: "Deployment",
      apiVersion: "apps/v1",
      name: "my-deploy",
      namespace: "default",
      patch: "{}",
    });

    expect(mockPatch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "Deployment", metadata: { name: "my-deploy", namespace: "default" } }),
      undefined, undefined, "kubernetes-mcp", undefined,
      { headers: { "Content-Type": "application/merge-patch+json" } }
    );
  });

  it("preserves name and namespace when patch contains a metadata field", async () => {
    mockPatch.mockResolvedValueOnce({ body: {} } as any);

    await handlePatchResource({
      kind: "Deployment",
      apiVersion: "apps/v1",
      name: "my-deploy",
      namespace: "default",
      patch: JSON.stringify({ metadata: { labels: { env: "prod" } } }),
    });

    expect(mockPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ name: "my-deploy", namespace: "default", labels: { env: "prod" } }),
      }),
      undefined, undefined, "kubernetes-mcp", undefined,
      { headers: { "Content-Type": "application/merge-patch+json" } }
    );
  });

  it("requires kind, apiVersion, name, and patch", async () => {
    await expect(
      handlePatchResource({ kind: "Deployment", apiVersion: "apps/v1" })
    ).rejects.toThrow();
  });
});

// ── delete_resource ───────────────────────────────────────────────────────────

describe("handleDeleteResource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a resource and returns a confirmation message", async () => {
    mockDelete.mockResolvedValueOnce({ body: {} } as any);

    const result = await handleDeleteResource({
      kind: "ConfigMap",
      apiVersion: "v1",
      name: "old-config",
      namespace: "default",
    });

    expect(getTextContent(result)).toContain("old-config");
    expect(getTextContent(result)).toContain("deleted");
  });

  it("passes the correct spec to the API", async () => {
    mockDelete.mockResolvedValueOnce({ body: {} } as any);

    await handleDeleteResource({
      kind: "Secret",
      apiVersion: "v1",
      name: "my-secret",
      namespace: "production",
    });

    expect(mockDelete).toHaveBeenCalledWith({
      apiVersion: "v1",
      kind: "Secret",
      metadata: { name: "my-secret", namespace: "production" },
    });
  });

  it("omits namespace in confirmation for cluster-scoped resources", async () => {
    mockDelete.mockResolvedValueOnce({ body: {} } as any);

    const result = await handleDeleteResource({
      kind: "Namespace",
      apiVersion: "v1",
      name: "old-ns",
    });

    expect(getTextContent(result)).not.toContain("namespace");
  });

  it("requires kind, apiVersion, and name", async () => {
    await expect(handleDeleteResource({})).rejects.toThrow();
  });
});
