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

- Node.js 22.12 or later (the CI matrix runs 22, 24, and 26)
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
configuration details (including the axios dts patch), the
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

`npm test` runs on the sources (ts-jest), so no build is needed first, except for two tests in `src/api/BaseApi.connectionReuse.test.ts` that start a child process against `dist/` and for `src/packedPackage.test.ts`, which packs the package and installs the tarball offline (build once before the first full run; without a build these tests fail, they never skip); otherwise `npm run build` is only needed to check the bundle, for example after a dependency change. `npm run test:packed` runs the packed checks without Jest. Run a subset with `npm run test:only -- <path pattern>`. Always go through these scripts: a bare `npx jest` fails because it lacks the `--experimental-vm-modules` flag. The directory you clone into must be named `frodo-lib`, because `src/utils/AutoSetupPolly.ts` finds the recordings through that path segment.

Do not edit `CHANGELOG.md` in a PR. It is generated at release time from what merged since the last release (the `Generate and promote AI changelog` step of `.github/workflows/pipeline.yml`), so write a clear PR title and description. The typedoc output in `docs/` is regenerated and committed by the same release job, so do not edit it either.

A pull request that changes only documentation, decision records, skills or instruction files skips the long test matrix; a fast `Validate guidance` job still checks the records, the skills and `AGENTS.md`, and `Test gate` waits for it. Any other file starts the full suite. [PIPELINE.md](PIPELINE.md) lists what counts as which.

### Testing with recorded HTTP traffic

Unit tests in frodo-lib replay recorded HTTP responses instead of calling a real environment, and consumers such as frodo-cli use the same machinery for their own tests. The [record and replay developer guide](RECORD_REPLAY.md) covers both the process-wide mechanism (`FRODO_MOCK`) that tools use and the in-process Jest helper (`autoSetupPolly()`, `FRODO_POLLY_MODE`) that frodo-lib's own tests use. Read it before changing anything in `src/utils/SetupPollyForFrodoLib.ts`, `src/utils/PollyUtils.ts` or `src/utils/AutoSetupPolly.ts`, and update it in the same PR.

### Code structure and conventions

Frodo Library adheres to the following folder and file structure:

```preformated
├── dist                     Build output (generated, gitignored): index.mjs
│                            (the one ES module build, which `require` and
│                            `import` both load) and its type declarations
│                            (index.d.mts, and a copy index.d.cts).
├── docs                     Typedoc generated documentation (committed by the
│                            release job).
├── examples                 Sample code how to use the library.
├── resources                Resource files.
├── scripts                  Build scripts: help generation, the post-build
│                            step for dist/, the types deprecation banner,
│                            the axios types patch, the packed-package
│                            checks (pack-smoke).
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
├── test                     Jest setup (Polly replay integrity guard) and
│                            the probes of the packed-package checks
│                            (pack-smoke).
└── types                    Type declarations (generated, gitignored).
```

#### Code conventions

Most of Frodo Library's functionality is manipulating configuration of a Ping (formerly: ForgeRock) Identity Platform instance. Most of the configuration is stored in configuration and other objects, which can be managed individually.

To create a good and consistent developer experience for library users, library developers should follow these conventions:

##### Public API surface

The package root exports only `frodo`, `state`, `FrodoError`, and types. (The build adds one interoperability key, `'module.exports'`, to the built JavaScript only, for `require()`: [decisions/0020](decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md).) Add new runtime capabilities to the facade (`frodo.<domain>...`), not as package-root exports. Do not use wildcard value re-exports (`export * from`) in `src/index.ts`.

The MCP capability registry infers a method's operation type from its name prefix: `create`, `count`, `read` (a plural name reads all), `update`, `delete`, `query` or `search`, `list`, `export`, `import`, and `pull` and `push` for file sets (a `pull` is classed as an `export`, a `push` as an `import`: [the naming of pull and push](https://github.com/rockcarver/frodo-lib/blob/main/decisions/0021-crudq-naming-for-facade-methods-and-pull-and-push-as-file-set-verbs.md)). Any other name is a "special" capability and needs a reviewed entry in `src/mcp/CapabilityMetadata.ts`; the capability registry test fails until it has one (pure helpers are usually marked `excluded: true` with a reason). A conventionally named method only needs an entry when the inferred defaults are wrong.

A bulk method may take a trailing `resultCallback` that reports each item (a failed item does not stop the others). An MCP caller cannot send a function, so the registry never offers that parameter and the tool runtime passes a collecting callback in its place: the tool result keeps its shape, and when at least one item failed it also carries `partial: true` and `itemResults` (the failed items, with their `INSUFFICIENT_SCOPE` or other code, and the number of items that succeeded). This needs no entry in `src/mcp/CapabilityMetadata.ts`: the callback is found in the signature of the method (`src/lib/Help.ts`), and `src/mcp/CapabilityRegistry.resultCollector.unit.test.ts` fails for a method that takes a result callback and would not get a collector. Name the parameter `resultCallback`.

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
| pull   | pullKbaConfig                 | Read from the tenant and return a file set.              |
| push   | pushKbaConfig                 | Push a file set from a reader to the tenant.             |

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

If the module is for a configuration type that the generic code of its family also reads (an agent type with a module of its own, for example), give the type one owner. In the same pull request, add the type to `AGENT_TYPES_WITH_OWN_MODULE` in `src/ops/AgentOps.ts` (agent types), give it its own key in a full export (`FullRealmExportInterface` in `src/ops/ConfigOps.ts`) and its row in the guard test `src/ops/ConfigOps.ownModules.unit.test.ts`, and change the generic code of the family to skip the type while it still accepts it on import, so that earlier exports keep importing. Otherwise a full export holds every object of the type twice. Changing the owner of a type goes in steps (add and release the new owner, make the generic code tolerant of the old layout, then let go of the generic code) and is a [MIGRATION.md](MIGRATION.md) item. See [core 0022 A configuration type has one owner in every layer](decisions/core/0022-a-configuration-type-has-one-owner-in-every-layer.md).

### Adding a configuration type to the file-set registry

A configuration type that is pulled into a folder of files and pushed back from it has one owner ([a configuration type has one owner in every layer](https://github.com/rockcarver/frodo-lib/blob/main/decisions/core/0022-a-configuration-type-has-one-owner-in-every-layer.md)), a pull and a push on the facade ([the naming of pull and push](https://github.com/rockcarver/frodo-lib/blob/main/decisions/0021-crudq-naming-for-facade-methods-and-pull-and-push-as-file-set-verbs.md)), a pure split and merge in its module, and one descriptor in the list in `src/ops/ConfigTypeRegistry.ts` ([the library turns configuration into file sets and back through the type's own read and write and never touches the file system](https://github.com/rockcarver/frodo-lib/blob/main/decisions/core/0028-the-library-turns-configuration-into-file-sets-through-the-types-own-read-and-write.md)). The KBA configuration (`pullKbaConfig`, `pushKbaConfig`, `splitKbaConfig`, `mergeKbaConfig` and `kbaConfigType` in `src/ops/IdmConfigOps.ts`) is the pattern for a type that has one object in one file: copy it and change what differs, which is the id of the entity, the path of its file, the two order numbers and whether the file keeps `_rev`. Take the steps in this order.

1. **Find the owner.** It is the module that already reads and writes the type. A type with no module of its own and no reason for one stays with the module of its family (the config entities of the IDM are in `IdmConfigOps.ts`). Write down the requests that the type makes today and the bytes of the files it writes today. A pull reads the type's own entity with the function of its owner and does not go through the export, so its requests are those of that read, and the bytes of its files may differ from today's only in the cases that [the record on file sets](https://github.com/rockcarver/frodo-lib/blob/main/decisions/core/0028-the-library-turns-configuration-into-file-sets-through-the-types-own-read-and-write.md) lists; say in the pull request which of them the files of the type meet.
2. **Write the four functions in the owner module,** each taking one options object that ends in `state`. `split<Type>` and `merge<Type>` are pure and are exported from the module, not put on the facade. For a type that has one object in one file, the engine does the work (`src/ops/internal/FileSetEngine.ts`): `splitSingleton` writes the file, `mergeSingleton` reads it back, and `mergeAndWriteSingleton` runs the push; a type passes in the path of its file, its id and whether the file keeps `_rev`. The id of such a type is a constant of the type, and `mergeSingleton` refuses a file that holds another id (the push then sends nothing, and its outcome is the path of the file): a file set comes from a reader that the library does not control, and an id such as `../managed/x` would be a request to another path. The comparison is exact, with no case folding, no trimming and no Unicode normalisation, and the refusal never repeats the id that the file holds, because that id can be the value of a placeholder. A type with a list of objects has no such constant: an id that it reads from the content of a file and puts into a URL needs an exact check of its own, which is decided in [the record on naming and results](https://github.com/rockcarver/frodo-lib/blob/main/decisions/0021-crudq-naming-for-facade-methods-and-pull-and-push-as-file-set-verbs.md) (see "Results, findings, progress and large collections" below): the type names the shape of its id and the engine checks it. The check never compares the id with the name of the file that held it, because a push never reads a file name ([a name that does not fit in a file name is shortened and ends with a checksum](https://github.com/rockcarver/frodo-lib/blob/main/decisions/core/0027-a-name-that-does-not-fit-in-a-file-name-is-shortened-and-ends-with-a-checksum.md)). A type whose object holds no `_id` (the cookie domains of Cloud have `{ domains: [] }`) passes `idKey: null`, and a file at the root of the set owns no folder; the shared suite has a row for each of these shapes, and the cookie domains shape goes through the api of the Cloud environment, whose scope is not the one of the IDM. `pull<Type>` reads the type from the tenant through the function that reads it today (`readConfigEntity` for a config entity) with one request for one object, and splits it; it does not go through the export, which would put `${NAME}` back for a value that the state holds. It returns the `VirtualFileSet` and writes nothing. `push<Type>` merges, then writes through the import that exists today (the private `pushConfigEntity` for a config entity, which is private to `IdmConfigOps.ts`). A type that has no import function (the IDM authentication config is written with `updateConfigEntity`, the cookie domains with `updateCookieDomains`) calls `mergeAndWriteSingleton` itself, with the `write` that it needs. A type outside the IDM config entities writes its own functions around the engine's: the shape rows of the shared suite show them (`shapeFunctions` in `ConfigTypeRegistry.singletons.unit.test.ts`), and the row says the scope that the api of the type checks. The pull gives the file set for whatever the tenant answers: an answer that is not an object is split as it is, as the command line always did. A type with several objects uses the other functions of the engine (`assignFileNames`, `fileOfObject`, `buildFileSet`, `runPerObject`; the toy type in `src/test/utils/ToyType.ts` shows them). The module imports no `fs`, prints nothing and wraps a failure in a `FrodoError` that keeps the cause.
3. **Write the descriptor** in the same module, as `<type>ConfigType` of type `ConfigTypeDescriptor`: `key` (the word the type goes by, in lower case), `scope`, `isStatic`, `deployments`, `exportOrder`, `importOrder`, and `pull` and `push`, which are typed (`FileSetPull` and `FileSetPush` in `src/ops/OpsTypes.ts`, with the descriptor itself): a pull takes `{ state }` and gives a `VirtualFileSet`, a push takes `{ reader, resultCallback, state }` and gives `PushOutcome[]`. The order numbers are the place of the type in the lists of the command line, in tens: `exportOrder` in the Cloud list of the full pull (the KBA configuration is the 14th: 140), `importOrder` in the list of static types, which the full static pull and the full static push share (13th: 130). A type that is not static has no place in the second list, and the first such type decides what it is given. A type that is exported inside another type's export (the config entities of the IDM) has no `export` and no `import` of its own.
4. **Add the descriptor to the list** `ConfigTypeRegistry` in `src/ops/ConfigTypeRegistry.ts`, in the order of a pull, and its owner module to the list of the owner modules in `ConfigTypeRegistry.unit.test.ts` if it is a new one. A module does not register itself.
5. **Write the golden folder** `src/test/golden/<key>/` by hand, from a captured entity with sample data only (made-up names, the sample host): `entity.json` is the entity as the tenant has it, with a `_rev`, a modified property, text that is not ASCII and a `${`; `files/` holds the files that the split must give, byte for byte; `owned-folders.json` lists the owned folders. The test compares them with `goldenDifferences`.
6. **Write the tests first,** and give each a negative proof (revert the production line, see the test fail, put the numbers in the pull request). A type with one object adds a row to the shared suite `src/ops/ConfigTypeRegistry.singletons.unit.test.ts` (its key, owner source, golden folder, path, owned folders, id, whether the object holds an id, the scope of its api, its four functions and the requests of its pull and push), which gives it the tests that every such type has: the split against the golden folder, the refusals of the merge, the requests of the pull and of the push, the body of the push (the golden file with its placeholders filled), that a token of another scope sends nothing, the outcomes, and a push of a file that holds another id, or an id that is a placeholder, that sends nothing and shows no value. What is about the type alone goes in `<Module>.<type>FileSet.unit.test.ts` next to the module: the requests of the read and of the import that the type makes today, compared with a stub adapter (`src/test/utils/StubAdapter.ts`) and with its recorded runs; the bytes equal to what the command line writes today; the rules of its entity. The helpers of these tests are in `src/test/utils/FileSetTestKit.ts`.
7. **Put the two methods on the facade type of the module** with TSDoc (`@param`, `@returns`; no `{@link}` to a symbol that the module does not export; no command line option), add the delegates to the factory, and run `npm run build`: it regenerates `src/lib/Help.ts` (commit it) and the types. `git status` must be clean after a second build.
8. **Check for secrets.** A type whose entity can hold a secret (an encrypted value, a password) never writes it in the clear: [secrets are never exported in the clear](https://github.com/rockcarver/frodo-lib/blob/main/decisions/core/0013-secrets-are-never-exported-in-the-clear.md). Say in the golden entity and in the pull request what the file holds for it.
9. **Say what MCP does with them.** The registry infers `export` for a pull (medium risk, not mutating, never in the read-only dispatch) and `import` for a push. Until the MCP server offers file sets, give each of the two ids an entry `{ excluded: true }` in `src/mcp/CapabilityMetadata.ts`, with the reason in a comment. A method name that has `secret`, `password`, `token`, `credential`, `serviceAccount`, `apiKey` or `privateKey` in it is classed `critical` by `inferRiskClass`, whatever the verb.
10. **Run the conformance test** `src/ops/ConfigTypeRegistry.types.unit.test.ts`, which walks the list: every key and order number is used once, every `pull` and `push` is on the facade exactly once and in `Help.ts`, and every type has a golden folder. The test next to it, `ConfigTypeRegistry.unit.test.ts`, fails for a `pull` or `push` function that no descriptor names.
11. **Check:** `npm run check`, `npx tsc --noEmit`, `npm run test:only -- src/ops/ConfigTypeRegistry src/ops/<Module> src/mcp/CapabilityRegistry`, and the whole suite once.
12. **Change the consumer in its own pull request,** after a prerelease of the library carries the new functions. The library pull request does not change a consumer, and a consumer that keeps its own copy of the type removes it in the pull request that calls the library. For the command line that is: delete the module of the type, make the two command bodies call the library through the adapters that write and read a file set, change the steps of the full pull and push, change the tests that name the module, add a fake-tenant test, and let the recordings replay. They replay unchanged only where the requests are unchanged: a request that the move changed (a pull that reads the entity where the command line exported it) needs a new recording, which a maintainer makes, and nobody edits a recording by hand.
13. **Say in the pull request** which tracking issues it is part of (`Part of`, never `Closes` on a tracking issue) and what you could not verify without a tenant.

**Results, findings, progress and large collections.** [The record on naming and results](https://github.com/rockcarver/frodo-lib/blob/main/decisions/0021-crudq-naming-for-facade-methods-and-pull-and-push-as-file-set-verbs.md) (proposed until the maintainer accepts it) decides how a new function reports. A function for a configuration type returns everything that its caller needs to decide an exit code, as data: a pull returns the file set and a list of findings (name clashes, refused ids and entries that cannot be read, never silent), a push returns `PushOutcome[]`, and a new function takes no per-object result callback; the `resultCallback` of the heritage functions stays until they are moved. Progress goes only through the progress indicators (`createProgressIndicator`, `updateProgressIndicator` and `stopProgressIndicator`, which a consumer plugs in with `state.setCreateProgressHandler` and its siblings) and messages only through the print and debug handlers. A pull of a type that exists today returns the `VirtualFileSet` alone; the change that adds the findings changes the pull of every type, which a prerelease may still do and which is a breaking change after 5.0.0. A collection that can be unbounded (managed objects, OAuth2 clients where dynamic registration is on, users, logs) is not a file-set type: it is read as an `AsyncIterable` of pages on the cookie paging of the API layer, a failed request throws out of the iteration with the last good cookie, a problem with one entry is a finding of its page, and a file-set type carries a `volume` that makes the engine refuse an unbounded one. A push checks each id before it reaches a URL: the type names the shape of its id (a prefix, or none) and the engine checks the prefix and one safe segment, refuses a second file with the same id and refuses an `_id` whose raw text holds `${`. The names of the result type, of the findings and of the id check are chosen in the pull request that adds them.

### Decision records

Lasting decisions are written down in [decisions/](decisions/README.md) (decisions that span frodo-lib and frodo-cli are core records, the same files in both repositories, in [decisions/core/](decisions/core/)). Accepted records are binding until a newer record supersedes them, so read the ones near your change, and when your pull request changes a decided behaviour, add a record or supersede one in the same pull request. `npm test` checks the records' front matter, sections and index. The folder is `decisions/` and not `docs/decisions/` because `docs/` here is regenerated typedoc output.

### Working with coding agents

`AGENTS.md` at the repository root and the files in `.github/instructions/` give coding agents (GitHub Copilot and others) the short version of this guide: the build and test commands, the hard rules, and checklists that load when a matching file is edited. They link back here for the detail, so keep this guide current and treat those files as an index into it. When a rule changes, change it here first and then in the instruction file that points at it.

`AGENTS.md` opens with the five laws that get broken most, each with its reason and the check that catches it, and stays short; what matters for part of the code goes into a file of `.github/instructions/`. Claude Code does not read that folder: it reads `.claude/rules/`, which is generated from it ([core 0026](decisions/core/0026-agent-guidance-has-one-source-and-per-tool-copies-are-generated-from-it.md)). After you change an instruction file, run `npm run generate-claude-rules` and commit the result; never edit a file of `.claude/rules/` by hand. `npm run generate-claude-rules -- --check` lists what differs, and `src/claudeRules.test.ts` fails for it. To see which instruction files a Claude Code session loaded at launch, run `/context all` and read the memory files; to see which rules it has loaded since, ask the session. A source in a subfolder of `.github/instructions/` keeps its path in `.claude/rules/`.

Step-by-step procedures (build the library, record tests, write a decision record, review an agent's pull request, change the CI pipeline, release the library) are skills in [.claude/skills/](.claude/skills), which Claude Code and the GitHub Copilot cloud agent load on demand. They link the rules above and never restate them.
