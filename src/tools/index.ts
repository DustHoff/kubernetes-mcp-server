import { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { pingTool, handlePing } from "./ping.js";

/**
 * Registry of all available tools.
 * Add new tools here as they are implemented.
 */
export const tools: Tool[] = [pingTool];

/**
 * Dispatches tool calls to the appropriate handler.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  switch (name) {
    case "ping":
      return handlePing(args);

    default:
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: "${name}"`,
          },
        ],
      };
  }
}
