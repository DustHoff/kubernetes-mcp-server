import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Writable } from "stream";
import * as k8s from "@kubernetes/client-node";
import { kubeConfig } from "../k8s/client.js";

// ── Schema ────────────────────────────────────────────────────────────────────

const ExecInPodArgsSchema = z.object({
  name: z.string(),
  namespace: z.string().optional().default("default"),
  command: z.union([z.string(), z.array(z.string())]),
  container: z.string().optional(),
  timeoutSeconds: z.number().int().positive().optional().default(30),
});

// ── Tool definition ───────────────────────────────────────────────────────────

export const execInPodTool: Tool = {
  name: "exec_in_pod",
  description:
    "Execute a command inside a running pod container and return its stdout and stderr output.",
  inputSchema: {
    type: "object",
    required: ["name", "command"],
    properties: {
      name: {
        type: "string",
        description: "Name of the pod",
      },
      namespace: {
        type: "string",
        description: "Namespace of the pod (default: 'default')",
      },
      command: {
        oneOf: [
          { type: "string", description: "Shell command string (e.g. 'ls -la /app')" },
          {
            type: "array",
            items: { type: "string" },
            description: "Command and arguments as array (e.g. ['cat', '/etc/os-release'])",
          },
        ],
      },
      container: {
        type: "string",
        description:
          "Container name (required if the pod has more than one container)",
      },
      timeoutSeconds: {
        type: "number",
        description: "Maximum execution time in seconds (default: 30)",
      },
    },
  },
};

// ── Helper: collect stream output ────────────────────────────────────────────

function makeCollector(): { writable: Writable; output: () => string } {
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });
  return { writable, output: () => Buffer.concat(chunks).toString("utf-8") };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleExecInPod(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { name, namespace, command, container, timeoutSeconds } =
    ExecInPodArgsSchema.parse(args);

  // Normalise command to string[] – the Exec API expects an array
  const commandArray: string[] =
    typeof command === "string"
      ? ["/bin/sh", "-c", command]
      : command;

  const exec = new k8s.Exec(kubeConfig);
  const stdout = makeCollector();
  const stderr = makeCollector();

  await new Promise<void>((resolve, reject) => {
    // Enforce a hard timeout so the tool never hangs indefinitely
    const timer = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeoutSeconds}s`));
    }, timeoutSeconds * 1000);

    exec
      .exec(
        namespace,
        name,
        container ?? "",   // empty string = let the API pick the default container
        commandArray,
        stdout.writable,
        stderr.writable,
        null,              // no stdin
        false,             // no tty
        (status: k8s.V1Status) => {
          clearTimeout(timer);
          if (status.status === "Success") {
            resolve();
          } else {
            // Kubernetes reports non-zero exits via status.message
            reject(
              new Error(
                status.message ??
                  `Command exited with status: ${status.reason ?? "Unknown"}`
              )
            );
          }
        }
      )
      .catch((err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
  });

  const stdoutText = stdout.output();
  const stderrText = stderr.output();

  const lines: string[] = [];
  if (stdoutText) lines.push(stdoutText);
  if (stderrText) lines.push(`[stderr]\n${stderrText}`);

  return {
    content: [
      {
        type: "text",
        text: lines.join("\n") || "(no output)",
      },
    ],
  };
}
