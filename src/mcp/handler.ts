import { McpServer, StdioServerTransport } from "./sdk_compat.js";

/**
 * Start the MCP server on stdio transport.
 * Used when the app is invoked as an MCP server by an AI client.
 */
export async function startMcpStdio(
  server: InstanceType<typeof McpServer>,
): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
