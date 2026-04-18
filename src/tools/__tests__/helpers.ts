import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Extracts the text from the first content item of a CallToolResult.
 * Throws if the first item is not of type "text".
 */
export function getTextContent(result: CallToolResult): string {
  const first = result.content[0];
  if (first.type !== "text") {
    throw new Error(`Expected text content, got: ${first.type}`);
  }
  return first.text;
}
