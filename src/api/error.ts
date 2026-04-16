interface ProblemDetail {
  type?: string;
  title: string;
  detail?: string;
  instance?: string;
}

export function problemResponse(
  status: number,
  opts: ProblemDetail,
): Response {
  const body = {
    type: opts.type ?? `https://learning.app/errors/${statusToSlug(status)}`,
    title: opts.title,
    status,
    ...(opts.detail ? { detail: opts.detail } : {}),
    ...(opts.instance ? { instance: opts.instance } : {}),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function statusToSlug(status: number): string {
  switch (status) {
    case 400:
      return "bad-request";
    case 404:
      return "not-found";
    case 405:
      return "method-not-allowed";
    case 409:
      return "conflict";
    case 422:
      return "validation-error";
    default:
      return "server-error";
  }
}

export function notFound(detail: string, instance?: string): Response {
  return problemResponse(404, {
    title: "Resource not found",
    detail,
    instance,
  });
}

export function badRequest(detail: string, instance?: string): Response {
  return problemResponse(400, { title: "Bad request", detail, instance });
}

export function methodNotAllowed(instance?: string): Response {
  return problemResponse(405, {
    title: "Method not allowed",
    instance,
  });
}

import { type DomainError, isDomainError } from "../domain/errors.ts";

/**
 * Map a thrown DomainError to an RFC 7807 problem+json response.
 * Returns null if the value isn't a DomainError (caller decides what to do).
 */
export function problemFromDomainError(
  err: unknown,
  instance?: string,
): Response | null {
  if (!isDomainError(err)) return null;
  const e = err as DomainError;
  return problemResponse(e.status, {
    title: e.name,
    detail: e.message,
    instance,
  });
}
