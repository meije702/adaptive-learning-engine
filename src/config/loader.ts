import { parse as parseYaml } from "@std/yaml";
import { join } from "@std/path";
import {
  CurriculumConfigSchema,
  LearnerConfigSchema,
  SystemConfigSchema,
} from "./schemas/index.ts";
import type {
  CurriculumConfig,
  LearnerConfig,
  SystemConfig,
} from "./schemas/index.ts";
import type { ZodSchema } from "zod";

export interface AppConfig {
  system: SystemConfig;
  curriculum: CurriculumConfig;
  learner: LearnerConfig;
}

export class ConfigError extends Error {
  public readonly filePath: string;

  constructor(filePath: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Config error in ${filePath}: ${detail}`, { cause });
    this.name = "ConfigError";
    this.filePath = filePath;
  }
}

async function loadAndValidate<T>(
  filePath: string,
  schema: ZodSchema<T>,
): Promise<T> {
  let raw: string;
  try {
    raw = await Deno.readTextFile(filePath);
  } catch (err) {
    throw new ConfigError(filePath, err);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new ConfigError(filePath, new Error(`YAML parse error: ${err}`));
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ConfigError(
      filePath,
      new Error(`Validation failed:\n${issues}`),
    );
  }

  return result.data;
}

function defaultConfigDir(): string {
  const envDir = Deno.env.get("ALE_CONFIG_DIR");
  if (envDir) return envDir;

  const thisDir = new URL(".", import.meta.url).pathname;
  return join(thisDir, "..", "..", "config", "examples", "k8s-hybrid-cloud");
}

export async function loadConfig(configDir?: string): Promise<AppConfig> {
  const dir = configDir ?? defaultConfigDir();

  const [system, curriculum, learner] = await Promise.all([
    loadAndValidate(join(dir, "system.config.yaml"), SystemConfigSchema),
    loadAndValidate(
      join(dir, "curriculum.config.yaml"),
      CurriculumConfigSchema,
    ),
    loadAndValidate(join(dir, "learner.config.yaml"), LearnerConfigSchema),
  ]);

  return { system, curriculum, learner };
}
