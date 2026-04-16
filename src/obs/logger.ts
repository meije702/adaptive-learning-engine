/**
 * Minimal structured logger — JSON lines to stderr.
 *
 * Not an observability framework. Intentionally small: one function per
 * level, a shared `withCorrelationId` context, and a frozen `LogEvent`
 * shape consumers can rely on. Output goes to stderr so it does not
 * pollute MCP stdio transport (which uses stdout for protocol traffic).
 */

import { getCorrelationId } from "./correlation.ts";

export type LogLevel = "info" | "warn" | "error";

export interface LogEvent {
  ts: string;
  level: LogLevel;
  event: string;
  correlationId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, fields: Record<string, unknown>) {
  const payload: LogEvent = {
    ts: new Date().toISOString(),
    level,
    event,
    correlationId: getCorrelationId(),
    ...fields,
  };
  // stderr keeps MCP stdout clean for protocol frames
  console.error(JSON.stringify(payload));
}

export const log = {
  info(event: string, fields: Record<string, unknown> = {}) {
    emit("info", event, fields);
  },
  warn(event: string, fields: Record<string, unknown> = {}) {
    emit("warn", event, fields);
  },
  error(event: string, fields: Record<string, unknown> = {}) {
    emit("error", event, fields);
  },
};
