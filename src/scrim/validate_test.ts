import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { validateSceneDocument } from "./validate.ts";

function validScene() {
    return {
        protocolVersion: "1.0",
        scene: { name: "test", schemaVersion: "1" },
        steps: [{
            id: "s1",
            kind: "show",
            node: { type: "text", properties: { content: "Hello" } },
        }],
    };
}

describe("validateSceneDocument", () => {
    it("returns valid for a correct SceneDocument", () => {
        const result = validateSceneDocument(validScene());
        assertEquals(result.valid, true);
        assertEquals(result.errors.length, 0);
    });

    it("returns invalid when protocolVersion is missing", () => {
        const doc = validScene();
        // deno-lint-ignore no-explicit-any
        delete (doc as any).protocolVersion;
        const result = validateSceneDocument(doc);
        assertEquals(result.valid, false);
        assertEquals(result.errors.length > 0, true);
        assertEquals(
            result.errors.some((e) => e.path.includes("protocolVersion")),
            true,
        );
    });

    it("returns invalid when protocolVersion is wrong value", () => {
        const doc = { ...validScene(), protocolVersion: "2.0" };
        const result = validateSceneDocument(doc);
        assertEquals(result.valid, false);
        assertEquals(
            result.errors.some((e) => e.path.includes("protocolVersion")),
            true,
        );
    });

    it("returns invalid for duplicate step IDs", () => {
        const doc = {
            protocolVersion: "1.0",
            scene: { name: "test", schemaVersion: "1" },
            steps: [
                {
                    id: "s1",
                    kind: "show",
                    node: { type: "text", properties: { content: "A" } },
                },
                {
                    id: "s1",
                    kind: "show",
                    node: { type: "text", properties: { content: "B" } },
                },
            ],
        };
        const result = validateSceneDocument(doc);
        assertEquals(result.valid, false);
        assertEquals(
            result.errors.some((e) =>
                e.message.toLowerCase().includes("duplicate") || e.rule === "unique-ids"
            ),
            true,
        );
    });

    it("returns invalid when scene is missing", () => {
        const doc = {
            protocolVersion: "1.0",
            steps: [{
                id: "s1",
                kind: "show",
                node: { type: "text", properties: { content: "Hello" } },
            }],
        };
        const result = validateSceneDocument(doc);
        assertEquals(result.valid, false);
    });

    it("returns invalid when steps is missing", () => {
        const doc = {
            protocolVersion: "1.0",
            scene: { name: "test", schemaVersion: "1" },
        };
        const result = validateSceneDocument(doc);
        assertEquals(result.valid, false);
    });

    it("returns invalid for non-object input", () => {
        const result = validateSceneDocument("not an object");
        assertEquals(result.valid, false);
    });

    it("returns invalid for null input", () => {
        const result = validateSceneDocument(null);
        assertEquals(result.valid, false);
    });
});
