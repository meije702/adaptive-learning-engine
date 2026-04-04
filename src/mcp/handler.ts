import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";

/**
 * Start the MCP server on stdio transport.
 * Used when the app is invoked as an MCP server by an AI client.
 */
export async function startMcpStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
