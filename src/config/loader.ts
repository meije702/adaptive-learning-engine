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
import { type ThemeConfig, ThemeConfigSchema } from "./schemas/theme.ts";
import type { ZodSchema } from "zod";

export interface AppConfig {
  system: SystemConfig;
  curriculum: CurriculumConfig;
  learner: LearnerConfig;
  /** Optional per-course theming. Absent `theme.config.yaml` ⇒ `{}`. */
  theme: ThemeConfig;
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

/**
 * Load an OPTIONAL config file. Returns the caller's fallback when:
 *  - the file does not exist, or
 *  - the file exists but YAML-parses to null/undefined (e.g. every key
 *    commented out).
 * Parse errors and schema-validation errors still throw.
 */
async function loadOptional<T>(
  filePath: string,
  schema: ZodSchema<T>,
  fallback: T,
): Promise<T> {
  let raw: string;
  try {
    raw = await Deno.readTextFile(filePath);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return fallback;
    throw new ConfigError(filePath, err);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new ConfigError(filePath, new Error(`YAML parse error: ${err}`));
  }

  if (parsed === null || parsed === undefined) return fallback;

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

export async function loadConfig(configDir?: string): Promise<AppConfig> {
  const dir = configDir ?? defaultConfigDir();

  const [system, curriculum, learner, theme] = await Promise.all([
    loadAndValidate(join(dir, "system.config.yaml"), SystemConfigSchema),
    loadAndValidate(
      join(dir, "curriculum.config.yaml"),
      CurriculumConfigSchema,
    ),
    loadAndValidate(join(dir, "learner.config.yaml"), LearnerConfigSchema),
    loadOptional(join(dir, "theme.config.yaml"), ThemeConfigSchema, {}),
  ]);

  return { system, curriculum, learner, theme };
}
