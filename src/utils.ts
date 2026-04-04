import { createDefine } from "fresh";
import type { AppConfig } from "./config/loader.ts";
import type { Repositories } from "./db/repositories.ts";

export interface State {
  config: AppConfig;
  repos: Repositories;
}

export const define = createDefine<State>();
