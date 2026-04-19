import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes } from "@std/assert";
import { scan, stripComments } from "./check_no_scrim_vars.ts";

describe("scan (integration)", () => {
  it("reports zero violations on the current tree", async () => {
    const violations = await scan();
    assertEquals(violations.length, 0);
  });

  it("preserves source line numbers through comment stripping", () => {
    // Bug regression: an early version replaced block comments with "",
    // collapsing multi-line comments and shifting subsequent line numbers.
    const input = "a\n/*\n  x\n*/\nb\nvar(--scrim-color-primary)\n";
    const stripped = stripComments(input);
    const lines = stripped.split("\n");
    assertEquals(
      lines.length,
      input.split("\n").length,
      "line count preserved",
    );
    // The var() call should still be on the same line as in the source.
    assertEquals(lines[5], "var(--scrim-color-primary)");
  });
});

describe("stripComments", () => {
  it("removes block comments", () => {
    const input = "before /* var(--scrim-color-primary) */ after";
    assertEquals(stripComments(input).includes("var(--scrim-"), false);
  });

  it("removes multi-line block comments", () => {
    const input = "a\n/*\n  var(--scrim-color-primary)\n*/\nb";
    assertEquals(stripComments(input).includes("var(--scrim-"), false);
  });

  it("removes line comments", () => {
    const input = "const x = 1; // see var(--scrim-color-primary)";
    assertEquals(stripComments(input).includes("var(--scrim-"), false);
  });

  it("preserves URL-like protocols", () => {
    const input = "fetch('https://example.com/api')";
    assertStringIncludes(stripComments(input), "https://example.com/api");
  });

  it("preserves real code", () => {
    const input = "const color = 'var(--ale-color-primary)';";
    assertStringIncludes(stripComments(input), "var(--ale-color-primary)");
  });
});
