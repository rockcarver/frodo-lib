---
applyTo: 'src/index.ts,src/mcp/**/*.ts,MIGRATION.md,.github/README.md'
---

# The public surface and the migration guide

- **The package root exports only `frodo`, `state`, `FrodoError` and types.** `src/index.test.ts` fails on any other runtime export, and ESLint rejects `export *` of values in `src/index.ts`. A new capability is a method on the facade (`frodo.<domain>...`), registered in `src/lib/FrodoLib.ts`.
- **The MCP capability registry reads the facade.** `src/mcp/CapabilityMetadata.ts` is the single place for knowledge that cannot be inferred from a method name. Add an entry only when the inferred defaults are wrong, and always for a method whose name is outside the naming convention (see [ops-modules.instructions.md](ops-modules.instructions.md)).
- **Do not weaken the capability checks to get a green run.** `src/mcp/contract-gap-baseline.json` is empty, and the test "every special-kind capability has an explicit, reviewed CapabilityMetadata.ts entry" is zero-tolerance. Fix the metadata instead.
- **Removing or deprecating a public function is a migration item.** Add it to the target major's section of [MIGRATION.md](../../MIGRATION.md) in the existing format (module path, function names, the replacement), and keep the "Breaking changes and migration" summary in [.github/README.md](../README.md) short, linking to the guide. Check the claim against the built `dist/` before it is published.
- **Do not edit `CHANGELOG.md`.** It is generated at release time from what merged, so write a clear pull request title and description.
