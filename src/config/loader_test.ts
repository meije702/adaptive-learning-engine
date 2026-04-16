import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { ConfigError, loadConfig } from "./loader.ts";

const EXAMPLE_DIR = join(
    new URL(".", import.meta.url).pathname,
    "..",
    "..",
    "config",
    "examples",
    "k8s-hybrid-cloud",
);

describe("loadConfig", () => {
    describe("k8s-hybrid-cloud example", () => {
        it("should load system config correctly", async () => {
            const config = await loadConfig(EXAMPLE_DIR);

            assertEquals(config.system.server.port, 8000);
            assertEquals(config.system.auth.type, "bearer");
            assertEquals(config.system.storage.type, "deno-kv");
            assertEquals(config.system.ai.provider, "anthropic");
            assertEquals(config.system.mcp.transport, "sse");
            assertEquals(config.system.retention.multiplier_correct, 2.5);
            assertEquals(config.system.content.max_length.theory, 600);
            assertEquals(config.system.export.format, "json");
        });

        it("should load curriculum meta and structure", async () => {
            const config = await loadConfig(EXAMPLE_DIR);

            assertEquals(config.curriculum.meta.id, "k8s-hybrid-cloud");
            assertEquals(config.curriculum.meta.estimated_weeks, 16);
            assertEquals(config.curriculum.meta.language, "nl");
            assertEquals(config.curriculum.levels.length, 6);
            assertEquals(config.curriculum.phases.length, 4);
            assertEquals(config.curriculum.domains.length, 16);
            assertEquals(config.curriculum.stretch.frequency, 4);
        });

        it("should load curriculum bridge", async () => {
            const config = await loadConfig(EXAMPLE_DIR);

            assertEquals(
                config.curriculum.bridge.from?.label,
                "AWS serverless specialist",
            );
            assertEquals(
                config.curriculum.bridge.to.label,
                "K8s & hybrid cloud engineer",
            );
        });

        it("should load domain bridge structure", async () => {
            const config = await loadConfig(EXAMPLE_DIR);

            const firstDomain = config.curriculum.domains[0];
            assertEquals(firstDomain.id, "container-fundamentals");
            assertEquals(firstDomain.bridge.from?.label, "Lambda functions");
            assertEquals(firstDomain.bridge.from?.proficiency, "expert");
            assertEquals(firstDomain.bridge.to.proficiency, "intermediate");
        });

        it("should load phase bridge structure", async () => {
            const config = await loadConfig(EXAMPLE_DIR);

            assertEquals(
                config.curriculum.phases[0].bridge.from?.proficiency,
                "expert",
            );
        });

        it("should load learner config", async () => {
            const config = await loadConfig(EXAMPLE_DIR);

            assertEquals(config.learner.profile.name, "Sander");
            assertEquals(config.learner.profile.language, "nl");
            assertEquals(config.learner.profile.timezone, "Europe/Amsterdam");
            assertEquals(config.learner.background.technologies.length, 6);
            assertEquals(config.learner.intake.completed, false);
            assertEquals(config.learner.schedule.rest_day, 0);
            assertEquals(config.learner.schedule.day_plan["1"], "theory");
            assertEquals(config.learner.schedule.day_plan["5"], "assessment");
            assertEquals(config.learner.preferences.tone, "collegial");
        });
    });

    it("should parse domain prerequisites as string arrays", async () => {
        const config = await loadConfig(EXAMPLE_DIR);

        const arch = config.curriculum.domains.find((d) =>
            d.id === "k8s-architecture"
        );
        assertEquals(arch?.prerequisites, ["container-fundamentals"]);

        const first = config.curriculum.domains.find((d) =>
            d.id === "container-fundamentals"
        );
        assertEquals(first?.prerequisites, []);
    });

    it("should have levels with correct id range", async () => {
        const config = await loadConfig(EXAMPLE_DIR);

        const ids = config.curriculum.levels.map((l) => l.id);
        assertEquals(ids, [0, 1, 2, 3, 4, 5]);
        assertEquals(config.curriculum.levels[0].assessment_type, null);
        assertEquals(config.curriculum.levels[1].assessment_type, "theory");
    });

    it("should throw ConfigError for missing directory", async () => {
        await assertRejects(
            () => loadConfig("/nonexistent/path"),
            ConfigError,
        );
    });

    it("should use ALE_CONFIG_DIR env var", async () => {
        Deno.env.set("ALE_CONFIG_DIR", EXAMPLE_DIR);
        try {
            const config = await loadConfig();
            assertEquals(config.curriculum.meta.id, "k8s-hybrid-cloud");
        } finally {
            Deno.env.delete("ALE_CONFIG_DIR");
        }
    });
});
