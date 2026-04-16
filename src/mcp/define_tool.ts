/**
 * Typed tool-registration helper.
 *
 * Before: each of the 24 tools in src/mcp/server.ts registered via an
 * `AnyCallback` cast and duplicated its TypeScript arg shape inline. That
 * defeated per-tool type-checking and made the file a 782-line god module.
 *
 * After: tools are declared with a Zod schema and the handler's argument
 * type is inferred from that schema. The single `any` lives here in the
 * helper; consumer modules are fully typed.
 */

import type { z } from "zod";
import { McpServer } from "./sdk_compat.js";

// deno-lint-ignore no-explicit-any
type AnyCallback = (...args: any[]) => any;

/** Re-exported for consumers so they don't depend on the SDK shape directly. */
export type McpServerInstance = InstanceType<typeof McpServer>;

export interface ToolResult {
  content: { type: string; text: string }[];
}

/**
 * Register a tool with a typed Zod input schema. The handler receives the
 * parsed input (Zod-inferred type) and returns a ToolResult (or a Promise of one).
 */
export function defineTool<TSchema extends z.ZodTypeAny>(
  server: McpServerInstance,
  name: string,
  config: { description: string; inputSchema: TSchema },
  handler: (args: z.infer<TSchema>) => ToolResult | Promise<ToolResult>,
): void {
  server.registerTool(
    name,
    { description: config.description, inputSchema: config.inputSchema },
    handler as AnyCallback,
  );
}

/**
 * Convenience: wrap arbitrary JSON-serialisable data as an MCP text tool result.
 */
export function txt(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}
