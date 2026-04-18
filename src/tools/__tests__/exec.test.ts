import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTextContent } from "./helpers.js";

// ── Hoisted mocks (must be created before vi.mock factories run) ──────────────

const { mockExecMethod, MockExecClass } = vi.hoisted(() => {
  const mockExecMethod = vi.fn();
  const MockExecClass = vi.fn(() => ({ exec: mockExecMethod }));
  return { mockExecMethod, MockExecClass };
});

vi.mock("@kubernetes/client-node", () => ({
  Exec: MockExecClass,
}));

vi.mock("../../k8s/client.js", () => ({
  kubeConfig: {},
  coreV1Api: {},
  appsV1Api: {},
}));

import { handleExecInPod } from "../exec.js";

// ── Helper: make mockExecMethod behave like a successful exec call ─────────────

function mockSuccess(stdoutData = "", stderrData = "") {
  mockExecMethod.mockImplementation((...args: unknown[]) => {
    const stdout = args[4] as NodeJS.WritableStream;
    const stderr = args[5] as NodeJS.WritableStream;
    const statusCb = args[8] as (s: { status: string; message?: string }) => void;

    if (stdoutData) stdout.write(stdoutData);
    if (stderrData) stderr.write(stderrData);

    process.nextTick(() => statusCb({ status: "Success" }));
    return Promise.resolve();
  });
}

function mockFailure(message: string) {
  mockExecMethod.mockImplementation((...args: unknown[]) => {
    const statusCb = args[8] as (s: { status: string; message?: string; reason?: string }) => void;
    process.nextTick(() => statusCb({ status: "Failure", message }));
    return Promise.resolve();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("handleExecInPod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stdout output on success", async () => {
    mockSuccess("total 8\ndrwxr-xr-x 2 root root 4096 Jan  1 00:00 app\n");

    const result = await handleExecInPod({ name: "my-pod", command: "ls -la" });

    expect(result.isError).toBeUndefined();
    expect(getTextContent(result)).toContain("total 8");
    expect(getTextContent(result)).toContain("app");
  });

  it("converts a string command into ['/bin/sh', '-c', command]", async () => {
    mockSuccess("hello\n");

    await handleExecInPod({ name: "my-pod", command: "echo hello" });

    const calledWith = mockExecMethod.mock.calls[0];
    expect(calledWith[3]).toEqual(["/bin/sh", "-c", "echo hello"]);
  });

  it("passes an array command through unchanged", async () => {
    mockSuccess("hello\n");

    await handleExecInPod({ name: "my-pod", command: ["echo", "hello"] });

    const calledWith = mockExecMethod.mock.calls[0];
    expect(calledWith[3]).toEqual(["echo", "hello"]);
  });

  it("defaults namespace to 'default'", async () => {
    mockSuccess();

    await handleExecInPod({ name: "my-pod", command: "date" });

    const calledWith = mockExecMethod.mock.calls[0];
    expect(calledWith[0]).toBe("default"); // namespace
  });

  it("passes explicit namespace", async () => {
    mockSuccess();

    await handleExecInPod({ name: "my-pod", namespace: "kube-system", command: "id" });

    const calledWith = mockExecMethod.mock.calls[0];
    expect(calledWith[0]).toBe("kube-system"); // namespace
    expect(calledWith[1]).toBe("my-pod");       // pod name
  });

  it("passes the container name when provided", async () => {
    mockSuccess("sidecar output\n");

    await handleExecInPod({ name: "my-pod", command: "id", container: "sidecar" });

    const calledWith = mockExecMethod.mock.calls[0];
    expect(calledWith[2]).toBe("sidecar");
  });

  it("passes empty string for container when not provided (API picks default)", async () => {
    mockSuccess();

    await handleExecInPod({ name: "my-pod", command: "id" });

    const calledWith = mockExecMethod.mock.calls[0];
    expect(calledWith[2]).toBe(""); // empty → API default container
  });

  it("includes stderr prefixed with [stderr]", async () => {
    mockSuccess("", "warning: something went wrong\n");

    const result = await handleExecInPod({ name: "my-pod", command: "cmd" });

    const text = getTextContent(result);
    expect(text).toContain("[stderr]");
    expect(text).toContain("warning: something went wrong");
  });

  it("returns both stdout and stderr when both are present", async () => {
    mockSuccess("main output\n", "side warning\n");

    const result = await handleExecInPod({ name: "my-pod", command: "cmd" });

    const text = getTextContent(result);
    expect(text).toContain("main output");
    expect(text).toContain("[stderr]");
    expect(text).toContain("side warning");
  });

  it("returns '(no output)' when command produces no output", async () => {
    mockSuccess("", "");

    const result = await handleExecInPod({ name: "my-pod", command: "true" });

    expect(getTextContent(result)).toBe("(no output)");
  });

  it("rejects when Kubernetes reports a non-zero exit status", async () => {
    mockFailure("exit code 1");

    await expect(
      handleExecInPod({ name: "my-pod", command: "false" })
    ).rejects.toThrow("exit code 1");
  });

  it("rejects when the exec call itself throws", async () => {
    mockExecMethod.mockImplementation(() =>
      Promise.reject(new Error("WebSocket connection refused"))
    );

    await expect(
      handleExecInPod({ name: "my-pod", command: "id" })
    ).rejects.toThrow("WebSocket connection refused");
  });

  it("requires the name argument", async () => {
    await expect(handleExecInPod({ command: "id" })).rejects.toThrow();
  });

  it("requires the command argument", async () => {
    await expect(handleExecInPod({ name: "my-pod" })).rejects.toThrow();
  });
});
