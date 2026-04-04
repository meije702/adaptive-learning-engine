#!/usr/bin/env -S deno run -A --unstable-kv

/**
 * MCP Server entrypoint — runs on stdio transport.
 *
 * Usage with Claude Desktop or any MCP client:
 *   deno run -A --unstable-kv src/mcp/main.ts
 *
 * This provides the same tools as the REST API but via the MCP protocol.
 */
import { loadConfig } from "../config/loader.ts";
import { getKv } from "../db/kv.ts";
import { createRepositories } from "../db/factory.ts";
import { seedDomains } from "../db/seed.ts";
import { createMcpServer } from "./server.ts";
import { startMcpStdio } from "./handler.ts";

const config = await loadConfig();
const kv = await getKv();
const repos = createRepositories(kv, config.system);

await seedDomains(kv, config.curriculum, config.system);

const server = createMcpServer(repos, config);
await startMcpStdio(server);
