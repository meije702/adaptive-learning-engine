/**
 * Domain error taxonomy shared by REST and MCP boundaries.
 *
 * Each boundary maps these types to its own wire shape:
 *  - REST → RFC 7807 Problem Details via src/api/error.ts
 *  - MCP  → { error, code } JSON payload via src/mcp/define_tool.ts
 *
 * Domain functions (src/domain/*) throw these. Handlers that need to
 * short-circuit with a specific status code should also throw these
 * rather than returning Responses directly.
 */

export type DomainErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "internal";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;

  constructor(code: DomainErrorCode, message: string, status: number) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("validation", message, 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super("not_found", message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("conflict", message, 409);
    this.name = "ConflictError";
  }
}

/** True if the value is one of our domain errors. */
export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
