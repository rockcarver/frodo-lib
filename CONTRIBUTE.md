# Contribute to Frodo Library (frodo-lib)

Any direct commits to the repository are not allowed. Pull requests (PR) are most welcome. Please fork this repo and develop and test in that fork. Once you feel ready, please create a PR. For any major changes, please open an [issue](https://github.com/rockcarver/frodo-lib/issues) first to discuss what and why you'd like to change.

## Developing

### Forking this repo

Please refer to these couple of excellent resources for getting started with forking the repo and contributing to github open source projects in general. These are great reads not only for someone new to this, even regular github contributors may find some great tidbits of information.

- [https://github.com/firstcontributions/first-contributions](https://github.com/firstcontributions/first-contributions)
  Also take a look at [Additional material](https://github.com/firstcontributions/first-contributions/blob/master/additional-material/git_workflow_scenarios/additional-material.md) towards the end, as there are some good tips on that page.

OR

- [https://www.dataschool.io/how-to-contribute-on-github/](https://www.dataschool.io/how-to-contribute-on-github/)

### Prerequisites

- Node.js 22 or later (the CI matrix runs 22, 24, and 26)
- npm (included with Node.js)
- A GUI editor is highly recommended. The current developers use [VSCode](https://code.visualstudio.com/), but you are welcome to use others, like [Atom](https://atom.io/) or [Sublime](https://www.sublimetext.com/), etc. The repository contains configuration files for VSCode's [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [prettier](https://prettier.io/) add-ons, which will automatically lint the code and apply coding styles when using VSCode. The same files may work for other editors with similar add-ons, but this has not been tested.

### Clone the repo and install dependencies

```console
git clone https://github.com/rockcarver/frodo-lib.git
cd frodo-lib
npm ci
```

### Build

```console
npm run build
```

For how the build toolchain works — what each tool does and why, bundler
configuration details (including the axios dts postinstall patch), the
TypeScript version policy, and dependency-automation mechanics — see
[BUILD-ENV.md](BUILD-ENV.md).

### Develop

To automatically build as you develop, use:

```console
npm run dev
```

### Before submitting a PR

Before you submit a PR, make sure your code follows the frodo code formatting conventions, type checks, and all the existing and your new tests are passing.

```console
npm run check
npx tsc --noEmit
npm test
```

`npm test` runs on the sources (ts-jest), so no build is needed first; `npm run build` is only needed to check the bundle, for example after a dependency change. Run a subset with `npm run test:only -- <path pattern>`. Always go through these scripts: a bare `npx jest` fails because it lacks the `--experimental-vm-modules` flag. The directory you clone into must be named `frodo-lib`, because `src/utils/AutoSetupPolly.ts` finds the recordings through that path segment.

Do not edit `CHANGELOG.md` in a PR. It is generated at release time from what merged since the last release (the `Generate and promote AI changelog` step of `.github/workflows/pipeline.yml`), so write a clear PR title and description. The typedoc output in `docs/` is regenerated and committed by the same release job, so do not edit it either.

### Testing with recorded HTTP traffic

Unit tests in frodo-lib replay recorded HTTP responses instead of calling a real environment, and consumers such as frodo-cli use the same machinery for their own tests. The [record and replay developer guide](RECORD_REPLAY.md) covers both the process-wide mechanism (`FRODO_MOCK`) that tools use and the in-process Jest helper (`autoSetupPolly()`, `FRODO_POLLY_MODE`) that frodo-lib's own tests use. Read it before changing anything in `src/utils/SetupPollyForFrodoLib.ts`, `src/utils/PollyUtils.ts` or `src/utils/AutoSetupPolly.ts`, and update it in the same PR.

### Code structure and conventions

Frodo Library adheres to the following folder and file structure:

```preformated
├── dist                     Build output (generated, gitignored): index.js
│                            (CommonJS), index.mjs (ESM) and their type
│                            declarations.
├── docs                     Typedoc generated documentation (committed by the
│                            release job).
├── examples                 Sample code how to use the library.
├── resources                Resource files.
├── scripts                  Build scripts: help generation, the types
│                            deprecation banner, the axios types patch.
├── src                      Source files.
│   ├── api                  Api layer modules. Abstraction of platform
│   │   │                    REST APIs.
│   │   ├── classic          Classic deployment api layer modules.
│   │   └── cloud            Cloud api layer modules.
│   ├── ext                  External modules, which cannot be consumed
│   │                        as npm packages.
│   ├── lib                  Home of FrodoLib.ts (the facade) and the
│   │                        generated Help.ts.
│   ├── mcp                  Capability registry, policy and tool runtime
│   │                        behind frodo-cli's MCP server.
│   ├── ops                  Ops layer modules. This is the library layer.
│   │   │                    Business logic goes here.
│   │   ├── classic          Classic ops layer modules.
│   │   ├── cloud            Cloud ops layer modules.
│   │   ├── internal         Helpers shared by ops modules. Not exposed on
│   │   │                    the facade.
│   │   └── templates        Templates of different object types and schema.
│   ├── shared               Shared modules (state, constants).
│   ├── test                 Test resources. Tests sit next to the module they
│   │   │                    test.
│   │   ├── mock-recordings  Mock recordings (Polly.js).
│   │   ├── mocks            Old mock engine and mock files still in use
│   │   │                    for some tests.
│   │   ├── setup            Staging helpers for recorded tests.
│   │   ├── snapshots        Snapshot files (Jest).
│   │   └── utils            Test utilities.
│   └── utils                Utility modules.
├── test                     Jest setup (Polly replay integrity guard).
└── types                    Type declarations (generated, gitignored).
```

#### Code conventions

Most of Frodo Library's functionality is manipulating configuration of a Ping (formerly: ForgeRock) Identity Platform instance. Most of the configuration is stored in configuration and other objects, which can be managed individually.

To create a good and consistent developer experience for library users, library developers should follow these conventions:

##### Public API surface

The package root exports only `frodo`, `state`, `FrodoError`, and types. Add new runtime capabilities to the facade (`frodo.<domain>...`), not as package-root exports. Do not use wildcard value re-exports (`export * from`) in `src/index.ts`.

The MCP capability registry infers a method's operation type from its name prefix: `create`, `count`, `read` (a plural name reads all), `update`, `delete`, `query` or `search`, `list`, `export` and `import`. Any other name is a "special" capability and needs a reviewed entry in `src/mcp/CapabilityMetadata.ts`; the capability registry test fails until it has one (pure helpers are usually marked `excluded: true` with a reason). A conventionally named method only needs an entry when the inferred defaults are wrong.

##### Managing objects - CRUDQ

Adopt CRUDQ naming for object manipulation:

| Action | Examples                      | Comments                                                 |
| ------ | ----------------------------- | -------------------------------------------------------- |
| create | createJourney                 | Create should fail if object already exists.             |
| read   | readJourney readJourneys      | Read one or all objects of a kind.                       |
| update | updateJourney                 | Update object if it already exists, create it otherwise. |
| delete | deleteJourney, deleteJourneys | Delete one or all objects of a kind.                     |
| query  | queryJourneys                 | Query objects.                                           |
| export | exportJourney, exportJourneys | Export one or all objects of a kind.                     |
| import | importJourney, importJourneys | Import one or all objects of a kind.                     |

##### Managing properties

Use getters and setters for property manipulation.

| Action | Examples              | Comments                                              |
| ------ | --------------------- | ----------------------------------------------------- |
| get    | getJourneyDescription | Retrieve an individual property of an object.         |
| set    | setJourneyDescription | Set the value of an individual property of an object. |

##### Managing status

Some objects support status. Avoid using getters and setters for status if possible.

| Action  | Examples       | Comments                |
| ------- | -------------- | ----------------------- |
| enable  | enableJourney  | Enable a configuration. |
| disable | disableJourney | Disable a configuration |

##### Everything else

Pick meaningful function names. It's OK for them to be long, as long as they convey their purpose.

### Writing a new ops module

Adding support for another kind of platform object follows the same steps every time. Copy a neighbour, for example `src/api/ScriptTypeApi.ts` and `src/ops/ScriptTypeOps.ts`.

1. **The api layer.** `src/api/<Name>Api.ts` (in `cloud/` or `classic/` when the endpoints exist for one deployment type only) holds the URL templates, the API version, the skeleton types and one function per endpoint. Each function takes one options object that ends in `state` and sends the request through a `generate*Api` helper from `BaseApi.ts`.
2. **The ops layer.** `src/ops/<Name>Ops.ts` (same `cloud/` and `classic/` rule) holds the business logic. It exports a `type <Name>` with one method signature per public function, each with TSDoc (`@param`, `@returns`); a default export `(state: State): <Name> => ({ ... })` that delegates to the standalone exported functions; and those functions, which take one options object ending in `state`. Wrap a failure from the api layer in `throw new FrodoError('Error reading X', error)` so the cause is kept; a bare `Error` is for argument guards only. Print through `src/utils/Console.ts` (`printMessage`, `verboseMessage`, `debugMessage`, `createProgressIndicator`), never `console.*`.
3. **Register it** in `src/lib/FrodoLib.ts`: import the factory and the type, add the type to `Frodo`, and add the instance in `FrodoLib()`. A module that is not registered cannot be reached by library users.
4. **Name the methods with the convention** (see above). A method with any other name needs a reviewed entry in `src/mcp/CapabilityMetadata.ts`.
5. **Regenerate the help metadata.** The TSDoc of the public type feeds `src/lib/Help.ts` (the parameter descriptions the MCP capability registry reports). Run `npm run generate-help` (`npm run build` does it too) and commit the result; never edit `Help.ts` by hand.
6. **Test it.** A `<Name>Ops.unit.test.ts` with fakes needs no tenant. A recorded `<Name>Ops.test.ts` calls `autoSetupPolly()` and replays HTTP from `src/test/mock-recordings`; recording needs a real tenant (`npm run test:record <Name>`, see [RECORD_REPLAY.md](RECORD_REPLAY.md) and the header of any recorded test), so say in the PR when a test still needs one. Snapshots are updated only for an expected change.
7. **Migration.** A removed or deprecated public function goes into the target major's section of [MIGRATION.md](MIGRATION.md), and the "Breaking changes and migration" summary in [.github/README.md](.github/README.md) stays short and links there.
8. **Check.** `npm run check`, `npx tsc --noEmit` and `npm run test:only -- <Name>`.

### Decision records

Lasting decisions are written down in [decisions/](decisions/README.md) (decisions that span frodo-lib, frodo-cli and the Homebrew tap are in [rockcarver/frodo](https://github.com/rockcarver/frodo/tree/main/docs/decisions)). Accepted records are binding until a newer record supersedes them, so read the ones near your change, and when your pull request changes a decided behaviour, add a record or supersede one in the same pull request. `npm test` checks the records' front matter, sections and index. The folder is `decisions/` and not `docs/decisions/` because `docs/` here is regenerated typedoc output.

### Working with coding agents

`AGENTS.md` at the repository root and the files in `.github/instructions/` give coding agents (GitHub Copilot and others) the short version of this guide: the build and test commands, the hard rules, and checklists that load when a matching file is edited. They link back here for the detail, so keep this guide current and treat those files as an index into it. When a rule changes, change it here first and then in the instruction file that points at it.
