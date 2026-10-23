# Frodo Library: instructions for coding agents

`@rockcarver/frodo-lib` is a hybrid ESM and CJS TypeScript library that manages PingOne Advanced Identity Cloud, ForgeOps and classic deployments. It powers [frodo-cli](https://github.com/rockcarver/frodo-cli). TypeScript, Jest (ts-jest, ESM mode), Node.js 22 or later (CI runs 22, 24 and 26). The guide for humans, and the source for everything below, is [CONTRIBUTE.md](CONTRIBUTE.md).

## Build, check, test

```console
npm ci
npm run build                          # generate-help, tsdown (dist/) and the declarations in types/
npm run check                          # ESLint + Prettier check of src/**/*.ts (npm run fix writes)
npx tsc --noEmit                       # type check
npm run test:only -- <path pattern>    # for example src/mcp/CapabilityRegistry.test.ts
npm test                               # the whole suite
```

Tests run on the sources, so they need no build. Always go through `npm run test:only` or `npm test`: a bare `npx jest` fails because it lacks the `--experimental-vm-modules` flag. The directory you clone into must be named `frodo-lib`: `src/utils/AutoSetupPolly.ts` finds the recordings through that path segment, and every recorded test fails without it.

## Rules

- **Run `npm run check` and `npx tsc --noEmit` before you finish.** ESLint also rejects `export *` of values in `src/index.ts` and imports of `tinyrainbow` (colors come from `src/utils/ColorTheme.ts`).
- **New capabilities go on the `frodo` facade, never on the package root.** The root exports only `frodo`, `state`, `FrodoError` and types; `src/index.test.ts` fails on anything else. See [.github/instructions/ops-modules.instructions.md](.github/instructions/ops-modules.instructions.md).
- **Document every method of a module's public type with TSDoc.** `npm run generate-help` turns it into `src/lib/Help.ts`, which is generated and tracked: regenerate it, commit it, never edit it by hand.
- **Throw `FrodoError` from ops code and print through `src/utils/Console.ts`**, not `console.*`.
- **`dependencies` in `package.json` stays empty.** A package imported by shipped code goes in `devDependencies` and is bundled. See [.github/instructions/dependencies.instructions.md](.github/instructions/dependencies.instructions.md).
- **Do not edit `CHANGELOG.md`, `docs/`, `dist/` or `types/`.** The changelog and the typedoc output in `docs/` are generated at release time (`pipeline.yml`); `dist/` and `types/` are build output. A removed or deprecated public function goes into [MIGRATION.md](MIGRATION.md).
- **Do not update snapshots or recordings to make a run green.** Decide first whether the change is expected or a regression, and say so in the pull request. Never hand-write a recording. See [.github/instructions/tests.instructions.md](.github/instructions/tests.instructions.md).
- **Never commit credentials, keys or tokens**, including in a test fixture or a recording.
- **Do not edit the Repo Concierge's files**: `.github/workflows/*.lock.yml` and the `.md` workflow sources beside them, `janitor.yml`, `check-deployment.yml`, `concierge-updater.yml`, `dependency-watch.yml`, `plan-approval-resume.yml`, `pr-ready-signal.yml`, `.github/scripts/`, `.github/aw/` and the pin in `.github/concierge.yml`. An updater overwrites them. `pipeline.yml`, `doc.yml`, `dependabot*.yml`, `.github/agentic-workflows/scope.md` and `related-repos.md` belong to this repository.

## Where things live

| Path                                    | What                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/api/`                              | REST wrappers, one `<Name>Api.ts` per endpoint family; `cloud/` and `classic/` for deployment-specific ones     |
| `src/ops/`                              | The library layer: one `<Name>Ops.ts` per domain; `cloud/`, `classic/`, `internal/` (not exposed), `templates/` |
| `src/lib/FrodoLib.ts`                   | The `frodo` facade: every ops module is registered here. `Help.ts` beside it is generated                       |
| `src/mcp/`                              | Capability registry and policy behind frodo-cli's MCP server                                                    |
| `src/shared/`, `src/utils/`, `src/ext/` | State and constants; utilities (`Console.ts`, `ColorTheme.ts`); vendored modules                                |
| `src/**/*.test.ts`, `src/test/`         | Tests sit next to their module; `src/test/` holds recordings, snapshots and setup helpers                       |

More specific rules load automatically from `.github/instructions/` when you edit matching files: [ops-modules](.github/instructions/ops-modules.instructions.md), [public-api](.github/instructions/public-api.instructions.md), [tests](.github/instructions/tests.instructions.md), [dependencies](.github/instructions/dependencies.instructions.md).
