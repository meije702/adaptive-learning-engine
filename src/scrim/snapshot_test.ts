import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { toSceneDocumentSnapshot, unwrapSceneDocument } from "./snapshot.ts";

const RAW = { protocolVersion: "1", scene: {}, steps: [] };

describe("toSceneDocumentSnapshot", () => {
  it("wraps with schemaVersion 1", () => {
    const snap = toSceneDocumentSnapshot(RAW);
    assertEquals(snap.schemaVersion, 1);
    assertEquals(snap.document, RAW);
  });
});

describe("unwrapSceneDocument", () => {
  it("returns undefined for undefined", () => {
    assertEquals(unwrapSceneDocument(undefined), undefined);
  });

  it("returns null for null", () => {
    assertEquals(unwrapSceneDocument(null), null);
  });

  it("unwraps a new-format snapshot", () => {
    const snap = toSceneDocumentSnapshot(RAW);
    assertEquals(unwrapSceneDocument(snap), RAW);
  });

  it("passes old-format raw SceneDocument through unchanged", () => {
    assertEquals(unwrapSceneDocument(RAW), RAW);
  });

  it("does NOT treat an unrelated object with schemaVersion-like fields as a snapshot without a document key", () => {
    const other = { schemaVersion: 1, stuff: "x" };
    // No `document` key → treat as raw, return as-is.
    assertEquals(unwrapSceneDocument(other), other);
  });
});
