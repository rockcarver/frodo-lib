---
paths:
  - "src/ops/**/*.ts"
  - "src/api/**/*.ts"
  - "src/lib/FrodoLib.ts"
---
<!-- Generated: do not edit. Source: .github/instructions/ops-modules.instructions.md. Regenerate with: node scripts/generate-claude-rules.mjs -->

# Writing or changing an ops or api module

The full guide is [CONTRIBUTE.md, "Writing a new ops module"](../../CONTRIBUTE.md#writing-a-new-ops-module).

- **Two layers.** `src/api/<Name>Api.ts` wraps the REST endpoints: URL templates and functions that take `{ ..., state }` and call a `generate*Api` helper from `BaseApi.ts`. `src/ops/<Name>Ops.ts` is the library layer: business logic, import and export, progress output, and it calls the api layer for requests. Modules that only exist for one deployment type go in `cloud/` or `classic/` under both folders.
- **Module shape** (copy `src/ops/ScriptTypeOps.ts`): an exported `type <Name>` with one method signature per public function, each with TSDoc (`@param`, `@returns`); `export default (state: State): <Name> => ({ ... })` delegating to standalone exported functions; those functions take one options object that ends in `state` (`readScript({ scriptId, state })`).
- **Register the module** in `src/lib/FrodoLib.ts`: import the factory and the type, add the type to `Frodo`, add the instance in `FrodoLib()`. An ops module that is not registered cannot be reached by library users.
- **A configuration type has one owner in the library** ([core 0022](../../decisions/core/0022-a-configuration-type-has-one-owner-in-every-layer.md)). A pull request that gives a type its own module also adds the type to `AGENT_TYPES_WITH_OWN_MODULE` in `src/ops/AgentOps.ts` (agent types), gives it its own key in a full export (`FullRealmExportInterface` in `src/ops/ConfigOps.ts`) and its row in the guard test `src/ops/ConfigOps.ownModules.unit.test.ts`, and changes the generic code of the family to skip it while it still accepts it on import. Changing the owner of a type is a `MIGRATION.md` item.
- **Name methods with the convention:** `create`, `read` (the plural reads all), `update`, `delete`, `query` or `search`, `list`, `count`, `export`, `import`; `pull` and `push` for a configuration type that goes to a file set and back ([the naming of pull and push](https://github.com/rockcarver/frodo-lib/blob/main/decisions/0019-crudq-naming-for-facade-methods-with-pull-and-push.md): a pull is inferred as an `export`, a push as an `import`; the steps are in [CONTRIBUTE.md, "Adding a configuration type to the file-set registry"](../../CONTRIBUTE.md#adding-a-configuration-type-to-the-file-set-registry)); `get`/`set` for one property; `enable`/`disable` for status. The capability registry infers metadata from these prefixes. A method with any other name is a "special" capability and needs a reviewed entry in `CAPABILITY_META` (`src/mcp/CapabilityMetadata.ts`); `src/mcp/CapabilityRegistry.test.ts` fails until it has one. Do not add to the known-gaps baseline to turn that test green.
- **A time span parameter is milliseconds** ([core 0020](../../decisions/core/0020-time-spans-are-seconds-on-the-command-line-and-milliseconds-in-the-library.md)): a library function parameter that takes a time span takes milliseconds, and the CLI converts the seconds that a command line option takes.
- **The callback handler may return a promise** ([core 0009](../../decisions/core/0009-let-the-callback-handler-return-a-promise.md)): `CallbackHandler` is widened to `Callback | Promise<Callback>` and `checkAndHandle2FA` awaits it; a synchronous handler keeps working. The record's Known deviations section says whether the code has caught up.
- **Errors.** Wrap a failure from the api layer in `throw new FrodoError('Error reading X', error)` so the cause is kept. A bare `Error` is only for argument guards, as in `src/api/ManagedObjectApi.ts`.
- **Output** goes through `printMessage`, `verboseMessage`, `debugMessage` and `createProgressIndicator` from `src/utils/Console.ts`, never `console.*`.
- **After adding or changing a method or its TSDoc,** run `npm run generate-help` (`npm run build` does it too) and commit the regenerated `src/lib/Help.ts`. Never edit that file by hand.
- **Tests** go next to the module; see [tests.instructions.md](tests.instructions.md).
