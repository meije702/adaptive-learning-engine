import type { McpServerInstance } from "../define_tool.ts";
import type { Repositories } from "../../db/repositories.ts";
import type { AppConfig } from "../../config/loader.ts";

/**
 * Shared context every tool-module's `register(ctx)` receives.
 */
export interface ToolCtx {
  server: McpServerInstance;
  repos: Repositories;
  config: AppConfig;
}
