const serverMod = await import(
  "npm:@modelcontextprotocol/sdk@^1/server/mcp.js"
);
const stdioMod = await import(
  "npm:@modelcontextprotocol/sdk@^1/server/stdio.js"
);
const clientMod = await import("npm:@modelcontextprotocol/sdk@^1/client");
const inMemoryMod = await import(
  "npm:@modelcontextprotocol/sdk@^1/inMemory.js"
);

export const McpServer = serverMod.McpServer;
export const StdioServerTransport = stdioMod.StdioServerTransport;
export const Client = clientMod.Client;
export const InMemoryTransport = inMemoryMod.InMemoryTransport;
