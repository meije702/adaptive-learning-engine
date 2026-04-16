import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  ConflictError,
  DomainError,
  isDomainError,
  NotFoundError,
  ValidationError,
} from "./errors.ts";

describe("DomainError hierarchy", () => {
  it("ValidationError has code=validation, status=400", () => {
    const e = new ValidationError("bad input");
    assertEquals(e.code, "validation");
    assertEquals(e.status, 400);
    assertEquals(e.message, "bad input");
    assertEquals(isDomainError(e), true);
  });

  it("NotFoundError has code=not_found, status=404", () => {
    const e = new NotFoundError("no such thing");
    assertEquals(e.code, "not_found");
    assertEquals(e.status, 404);
  });

  it("ConflictError has code=conflict, status=409", () => {
    const e = new ConflictError("clash");
    assertEquals(e.code, "conflict");
    assertEquals(e.status, 409);
  });

  it("isDomainError rejects non-domain errors", () => {
    assertEquals(isDomainError(new Error("regular")), false);
    assertEquals(isDomainError("string"), false);
    assertEquals(isDomainError(undefined), false);
  });

  it("ValidationError is an instance of DomainError and Error", () => {
    const e = new ValidationError("x");
    assertEquals(e instanceof DomainError, true);
    assertEquals(e instanceof Error, true);
  });
});
