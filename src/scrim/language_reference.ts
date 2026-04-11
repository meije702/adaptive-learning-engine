/**
 * Load the Scrim language reference for embedding in MCP instructions.
 *
 * Reads from the @scrim/schema package at build time. This is the compact
 * vocabulary reference that allows the AI agent to generate valid SceneDocuments.
 */
export async function loadLanguageReference(): Promise<string> {
  const refPath = import.meta.resolve(
    "@scrim/schema",
  );
  // Navigate from schema/mod.ts to the reference file
  const schemaDir = new URL(".", refPath);
  const langRefUrl = new URL(
    "src/reference/language_reference.md",
    schemaDir,
  );

  return await Deno.readTextFile(langRefUrl);
}
