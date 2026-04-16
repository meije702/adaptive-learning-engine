/**
 * Per-request / per-tool-call correlation IDs via AsyncLocalStorage.
 *
 * Any code running inside `withCorrelationId(id, fn)` — including awaited
 * repository calls and logger emissions — sees the same `getCorrelationId()`.
 * When code runs outside a bound context, the getter returns undefined.
 */

import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage<string>();

export function withCorrelationId<T>(
  id: string,
  fn: () => Promise<T>,
): Promise<T>;
export function withCorrelationId<T>(id: string, fn: () => T): T;
export function withCorrelationId<T>(
  id: string,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return store.run(id, fn);
}

export function getCorrelationId(): string | undefined {
  return store.getStore();
}

/** Generate a short, URL-safe correlation ID. */
export function newCorrelationId(): string {
  return crypto.randomUUID();
}
