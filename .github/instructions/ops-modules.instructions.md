---
applyTo: 'src/ops/**/*.ts,src/api/**/*.ts,src/lib/FrodoLib.ts'
---

# Writing or changing an ops or api module

The full guide is [CONTRIBUTE.md, "Writing a new ops module"](../../CONTRIBUTE.md#writing-a-new-ops-module).

- **Two layers.** `src/api/<Name>Api.ts` wraps the REST endpoints: URL templates and functions that take `{ ..., state }` and call a `generate*Api` helper from `BaseApi.ts`. `src/ops/<Name>Ops.ts` is the library layer: business logic, import and export, progress output, and it calls the api layer for requests. Modules that only exist for one deployment type go in `cloud/` or `classic/` under both folders.
- **Module shape** (copy `src/ops/ScriptTypeOps.ts`): an exported `type <Name>` with one method signature per public function, each with TSDoc (`@param`, `@returns`); `export default (state: State): <Name> => ({ ... })` delegating to standalone exported functions; those functions take one options object that ends in `state` (`readScript({ scriptId, state })`).
- **Register the module** in `src/lib/FrodoLib.ts`: import the factory and the type, add the type to `Frodo`, add the instance in `FrodoLib()`. An ops module that is not registered cannot be reached by library users.
- **Name methods with the convention:** `create`, `read` (the plural reads all), `update`, `delete`, `query` or `search`, `list`, `count`, `export`, `import`; `get`/`set` for one property; `enable`/`disable` for status. The capability registry infers metadata from these prefixes. A method with any other name is a "special" capability and needs a reviewed entry in `CAPABILITY_META` (`src/mcp/CapabilityMetadata.ts`); `src/mcp/CapabilityRegistry.test.ts` fails until it has one. Do not add to the known-gaps baseline to turn that test green.
- **Errors.** Wrap a failure from the api layer in `throw new FrodoError('Error reading X', error)` so the cause is kept. A bare `Error` is only for argument guards, as in `src/api/ManagedObjectApi.ts`.
- **Output** goes through `printMessage`, `verboseMessage`, `debugMessage` and `createProgressIndicator` from `src/utils/Console.ts`, never `console.*`.
- **After adding or changing a method or its TSDoc,** run `npm run generate-help` (`npm run build` does it too) and commit the regenerated `src/lib/Help.ts`. Never edit that file by hand.
- **Tests** go next to the module; see [tests.instructions.md](tests.instructions.md).
