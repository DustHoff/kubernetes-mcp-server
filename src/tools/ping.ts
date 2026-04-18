import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const PingArgsSchema = z.object({
  message: z.string().optional().default("pong"),
});

/**
 * Example tool: ping
 *
 * A simple health-check tool that echoes back a message.
 * Replace or remove this with real Kubernetes tools.
 */
export const pingTool: Tool = {
  name: "ping",
  description:
    "Simple health-check tool. Returns the provided message or 'pong' by default.",
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Message to echo back (default: 'pong')",
      },
    },
  },
};

export async function handlePing(
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { message } = PingArgsSchema.parse(args);

  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  };
}
