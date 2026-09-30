# Recording and replaying HTTP traffic

frodo-lib can record the HTTP traffic it produces against a real environment and replay it later with no network access. This is how [frodo-cli](https://github.com/rockcarver/frodo-cli) runs its whole end-to-end test suite offline, and it is available to any tool built on frodo-lib.

This guide is for **developers of tools that use frodo-lib** (CLIs, scripts, test suites, other applications). It explains how to record, how to replay, and how the recordings are organized. For how frodo-cli uses these mechanisms for its own tests, see [frodo-cli's e2e README](https://github.com/rockcarver/frodo-cli/blob/main/test/e2e/README.md). For frodo-lib's own unit tests, which use a separate in-process helper, see [In-process helper for Jest tests](#in-process-helper-for-jest-tests-frodo-libs-own-tests).

- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Environment variables](#environment-variables)
- [Recording identity and layout](#recording-identity-and-layout)
- [Request routing](#request-routing)
- [Request matching](#request-matching)
- [Hosts](#hosts)
- [Shared login cassettes](#shared-login-cassettes)
- [Secrets, time, and expiration](#secrets-time-and-expiration)
- [Workflows](#workflows)
- [Gotchas](#gotchas)
- [In-process helper for Jest tests](#in-process-helper-for-jest-tests-frodo-libs-own-tests)
- [Extending the framework](#extending-the-framework)
- [Where the code lives](#where-the-code-lives)

## Quick start

Suppose you have a tool, `mytool.mjs`, that lists the journeys of a tenant:

```javascript
// mytool.mjs
const { frodo } = await import('@rockcarver/frodo-lib');

const instance = frodo.createInstanceWithServiceAccount(
  process.env.FRODO_HOST, // e.g. https://openam-mytenant.forgeblocks.com/am
  process.env.FRODO_SA_ID,
  process.env.FRODO_SA_JWK
);
if (await instance.login.getTokens()) {
  const journeys = await instance.authn.journey.readJourneys();
  console.log(journeys.map((j) => j._id).join('\n'));
}
```

**Record** it once against a real tenant. Because the host is a `*.forgeblocks.com` tenant, its login goes to the [shared login cassette](#shared-login-cassettes), which a normal recording run never writes to. In a new project the cassette does not exist yet, so the **first** recording run must populate it (afterwards, drop the two `SHARED_AUTH` variables):

```console
FRODO_MOCK=record FRODO_NO_CACHE=1 \
FRODO_MOCK_DEPLOYMENT=cloud FRODO_MOCK_REFRESH_SHARED_AUTH=1 \
FRODO_MOCK_HOSTS=https://openam-mytenant.forgeblocks.com \
FRODO_TEST_NAME=listJourneys \
FRODO_HOST=https://openam-mytenant.forgeblocks.com/am FRODO_SA_ID=... FRODO_SA_JWK=... \
node mytool.mjs
```

(If you would rather not use a shared cassette, add `FRODO_MOCK_DEDICATED_AUTH=1` to every record and replay run instead, and each run keeps its own login recordings.)

Wait for the `Polly instance '...' stopping in 3s...` countdown to finish (see [Gotchas](#gotchas)). Recordings appear under `./test/e2e/mocks/`:

```
test/e2e/mocks/shared_<hash>/auth_<hash>/cloud_<hash>/...     the shared login cassette
test/e2e/mocks/mytool_<hash>/listJourneys_<hash>/am_<hash>/recording.har
...
```

**Replay** it, with no network access:

```console
FRODO_MOCK=1 FRODO_MOCK_HOSTS=https://openam-mytenant.forgeblocks.com \
FRODO_TEST_NAME=listJourneys \
FRODO_HOST=https://openam-mytenant.forgeblocks.com/am FRODO_SA_ID=... FRODO_SA_JWK=... \
node mytool.mjs
```

Things that must hold for this to work:

- **Set `FRODO_MOCK` before frodo-lib is loaded.** The hook is installed when the library's HTTP layer is first imported (`src/api/BaseApi.ts`). In an ES module, static `import`s are hoisted above any `process.env.FRODO_MOCK = ...` line, so either set the variable in the shell (as above) or load the library with a dynamic `import()` after setting it.
- **Set `FRODO_MOCK_HOSTS` to your host(s)** unless you only use the built-in frodo development hosts. See [Hosts](#hosts).
- **Set `FRODO_TEST_NAME`** for anything that is not the `frodo` binary. See [Recording identity and layout](#recording-identity-and-layout).
- **Credentials must be well-formed in replay mode.** The login code still runs; it just receives its responses from the recordings. A service account JWK must be a valid key (it signs the assertion), but it does not have to belong to any real tenant.

## How it works

frodo-lib uses [Polly.js](https://netflix.github.io/pollyjs/) with its Node HTTP adapter and file-system persister. When `FRODO_MOCK` is set, `api/BaseApi.ts` calls `setupPollyForFrodoLib()` (`src/utils/SetupPollyForFrodoLib.ts`) at module load. Every HTTP request frodo-lib makes through axios is then either

- **replayed** from a recording on disk (`FRODO_MOCK=1`), failing with `Recording for the following request is not found` if there is none; or
- **passed to the real server and recorded** (`FRODO_MOCK=record`).

Recordings are [HAR](http://www.softwareishard.com/blog/har-12-spec/) files. They are meant to be committed to your repository.

The mechanism is configured **only through environment variables** (below). `setupPollyForFrodoLib` and its helpers are not part of the package's public API, so there are no programmatic hooks today; if you need one, see [Extending the framework](#extending-the-framework).

This mechanism is process-wide and is designed for tools that run frodo-lib in their own process, including tests that spawn that process. Only the Node HTTP stack is intercepted (frodo-lib's axios calls); browsers and `fetch` are not.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `FRODO_MOCK` | Unset: real network, no mocking. `record`: record. Any other value (use `1`): replay. |
| `FRODO_NO_CACHE` | Set to `1` when recording. Disables frodo-lib's on-disk token cache; otherwise a cached token can mean the login calls you want to capture never happen. |
| `FRODO_TEST_NAME` | Sets the recording identity explicitly. Record and replay must use the same value. See [Recording identity and layout](#recording-identity-and-layout). |
| `FRODO_MOCK_DIR` | Directory recordings are read from and written to. Default `test/e2e/mocks`, relative to the working directory. |
| `FRODO_MOCK_HOSTS` | Comma-separated list of origins (scheme, host, and port if non-default) whose traffic is routed to per-area recordings. Default: the frodo development hosts. See [Hosts](#hosts). |
| `FRODO_MOCK_DEPLOYMENT` | `cloud`, `forgeops` or `classic`. Selects the [shared login cassette](#shared-login-cassettes). |
| `FRODO_MOCK_DEDICATED_AUTH` | Set to any value to opt one run out of the shared login cassette (for example a test of invalid credentials). |
| `FRODO_MOCK_REFRESH_SHARED_AUTH` | Set to `1`, together with `FRODO_MOCK=record`, to deliberately write the shared login cassette. Without it a recording run never writes to it. |
| `FRODO_MOCK_EXPIRES_IN` | How long a recording is trusted. Default `90d`. |
| `FRODO_MOCK_EXPIRY_STRATEGY` | What happens to an expired recording: `warn` (default), `record` (re-record it) or `error`. |
| `FRODO_POLLY_LOG_LEVEL` | Polly's log level. Default `warn`. |

## Recording identity and layout

Each recording is stored at

```
<FRODO_MOCK_DIR>/<recording name, one directory per "/" segment>/<area>/recording.har
```

Every directory name is `<slug>_<hash>`, generated by Polly (for example `agent_1340600742`). Do not hand-write these names; if you need to move a recording, ask Polly for its id (`new Polly('<name>', { adapters: [] }).recordingId`).

The **recording name** is derived by `getFrodoCommand()` from the process that is running:

| Entry script (`process.argv[1]`) | Recording name |
| --- | --- |
| `frodo`, `frodo.exe`, `app.cjs` (frodo-cli) | `<command>/[<verb>/]<positional words joined by "-">/<args id>`, for example `agent/ai-delete/0_a` |
| anything else | `<script file name, first "-" turned into "/">/<args id>`, for example `mytool/listJourneys` |

The **args id** is `FRODO_TEST_NAME` when it is set. Otherwise it is derived from the arguments: the number of positional arguments after the first flag, then the flag names joined by `_` (`--all --file x` gives `0_all_file`).

Consequences worth knowing:

- **Set `FRODO_TEST_NAME` explicitly.** Without it, two invocations with the same flags silently share (and overwrite) one recording, and the name changes whenever you add or rename a flag, orphaning the old recording.
- **Positional words are part of the identity.** `frodo agent ai delete -i x` and `frodo agent ai delete some-host -i x` are different recordings.
- **Names never contain a hostname.** This is deliberate; see [Request matching](#request-matching).

The last directory (`<area>`) depends on the request; see the next section.

## Request routing

Requests to a host in `FRODO_MOCK_HOSTS` are grouped into areas by URL path, so one command's traffic is split across a few small recordings instead of one large one:

| Path | Area (last directory) |
| --- | --- |
| `/am/oauth2/*` | `oauth2` (or the shared login cassette) |
| `/am/json/*` | `am` |
| `/am/json/*/authenticate`, `/am/json/*/sessions/?_action=getSessionInfo` | shared login cassette, else `am` |
| `/am/saml2/*` | `saml2` |
| `/openidm/managed/svcacct`, `/openidm/managed/svcacct/*` | `openidm/managed/svcacct` |
| `/openidm/*` | `openidm` |
| `/environment/*` | `environment` (suffixed with the `--encoding` value when that flag is present) |
| `/iga/*`, `/auto/orchestration/*` | `iga` |
| `/keys`, `/monitoring/*`, `/feature`, `/dashboard/*` | `keys`, `monitoring`, `feature`, `dashboard` |
| `api.github.com`, `registry.npmjs.org` | `github`, `npmjs` |

A request that matches none of these, or that goes to a host that is not in `FRODO_MOCK_HOSTS`, is recorded under Polly's fallback name `default` (a `default_<hash>` directory at the top of the recordings folder). If you find one, an unlisted host is the usual cause.

## Request matching

Replay finds a recording by comparing the request against the recorded ones on:

- method
- URL pathname, query and hash
- request body (except on the login routes, where bodies contain fresh JWTs and PKCE verifiers)
- **order**: when the same request was recorded several times (for example a 404 existence check followed by a 200 after a create), the recordings replay in the recorded sequence

It deliberately **ignores** hostname, port, protocol, credentials in the URL, and all headers. That is a design decision, not a shortcut: a recording made against one tenant replays against any other, so developers can record against their own environment and everyone can replay. It also means **you must never key a recording name, cassette or matcher by hostname**, or you silently lose that property.

## Hosts

`FRODO_MOCK_HOSTS` controls which origins get the per-area routing described above. The default is:

```
https://openam-frodo-dev.forgeblocks.com
https://openam-volker-dev.forgeblocks.com
https://openam-volker-demo.forgeblocks.com
https://nightly.gcp.forgeops.com
http://openam-frodo-dev.classic.com:8080
```

For your own tenant, set it explicitly (comma-separated, including scheme and any port), otherwise its traffic lands in the `default` recording. Recorded URLs are otherwise normalized (`filterRecording`: proxy prefixes are stripped so a run through a proxy records the same as one without, and the `host` header is rewritten), but matching never depends on the host.

## Shared login cassettes

Almost every recorded run starts with the same login sequence (`/am/oauth2/*`, `/authenticate` and the session check that follows it). Recording it per run multiplies fixtures for no benefit, so the login sequence can instead be recorded **once per deployment type** and replayed by every run of that type:

| Deployment type | Cassette | Contents |
| --- | --- | --- |
| `cloud` | `shared/auth/cloud` | `authenticate` and `getSessionInfo`; sub-recordings `.../svcacct` (service-account JWT-bearer token) and `.../interactive` (authorization-code token) |
| `forgeops` | `shared/auth/forgeops` | `authenticate` and `getSessionInfo`; sub-recording `.../interactive` (the token IDM needs) |
| `classic` | `shared/auth/classic` | `authenticate` and `getSessionInfo` only; classic is AM-only and makes no oauth2 calls |

The three types get separate cassettes because their login flows differ: forgeops is a platform deployment (AM, IDM, DS) that needs an oauth2 token for IDM, while classic is AM-only.

**Choosing the cassette.** Set `FRODO_MOCK_DEPLOYMENT=cloud|forgeops|classic`. It has to be declared explicitly because the deployment type is not known when the recording hook is configured (frodo-lib detects it during login), and classic and forgeops login requests are indistinguishable up to that point. As a fallback, requests to `*.forgeblocks.com` are treated as `cloud` when the variable is unset. With neither, login is recorded per run under the run's own name, as for any other area.

**First use in a new project.** A cassette only exists once something has written it. With `*.forgeblocks.com` hosts (or `FRODO_MOCK_DEPLOYMENT` set) the cassette is used automatically, but an ordinary recording run does not populate it, so the first recording run must set `FRODO_MOCK_REFRESH_SHARED_AUTH=1` (see the [quick start](#quick-start)), or the run must opt out with `FRODO_MOCK_DEDICATED_AUTH=1`.

**What matches inside a cassette.** Matching is by pathname and order only. The `getSessionInfo` path contains the realm (`.../realms/root/realms/alpha/sessions/...`), so **each realm you use needs its own entry in the cassette**. A run that logs in once always asks for order 0, which is why a cassette should contain one clean login per realm and not the accumulated history of many.

**Recording rules.**

- An ordinary recording run (`FRODO_MOCK=record`) does its login against the real server but does not record it (the login calls are passed through, unrecorded). The cassette is left untouched.
- To write the cassette, set `FRODO_MOCK_REFRESH_SHARED_AUTH=1` on **one** recording run, with `FRODO_MOCK_DEPLOYMENT` set to the type you are populating. Do this only deliberately, for example to bootstrap a new realm or type. The cassette is shared by every host of that type and is order-indexed, so overwriting an entry during an unrelated run can break every other run that relied on that position. If you refresh it from two different tenants, whichever tenant's token sits at order 0 is served to everyone.
- A run that needs its own login (for example an invalid-credentials test) sets `FRODO_MOCK_DEDICATED_AUTH=1` to bypass the cassette and use per-run recordings.
- The command must exit successfully for the new cassette entries to be flushed.

**Scope claims are rewritten at replay.** A cached token's `scope` does not have to match what the recording tenant granted: on replay, the `access_token` response's `scope` is overwritten with the scope the current request asked for, so frodo-lib's required-scope checks pass for any current or future scope with nothing to maintain in the fixture.

**Adding a deployment type.** Add its key to `SHARED_AUTH_DEPLOYMENT_TYPES` in `SetupPollyForFrodoLib.ts` and seed `shared/auth/<type>` with one recording run using `FRODO_MOCK_REFRESH_SHARED_AUTH=1`. Types not in that list keep per-run login recordings.

## Secrets, time, and expiration

**Secrets are filtered when a recording is written.** `filterRecording()` (`src/utils/PollyUtils.ts`) runs on every recording before it is persisted and masks:

- request/response headers: username/password headers, `Authorization`, `Cookie`/`Set-Cookie`, API key and secret headers, user agent, transaction id, date, etag, `alt-svc`, `via`
- response cookies
- bodies: `access_token`, `id_token`, `tokenId`, `accessKey`, the JWT `assertion` in form posts, X.509 certificates in XML, and secret-looking variables in script bodies

This is a **denylist**. It does not know about secrets in fields it has not been taught, so **review a recording's diff before committing it**, and never record against an environment holding data you cannot publish.

**Time-dependent responses are fixed up at replay.** A recorded session would be long expired by the time it is replayed, so on replay `getSessionInfo` responses have `maxIdleExpirationTime` moved to one day ahead and `maxSessionExpirationTime` to one day plus two hours ahead.

**Recordings expire.** By default a recording older than 90 days produces a warning on replay (never a failure). Treat the warning as a prompt to re-record. Set `FRODO_MOCK_EXPIRES_IN` and `FRODO_MOCK_EXPIRY_STRATEGY` (`warn`, `record`, `error`) to change this, for example to fail a CI run on stale fixtures.

**Recordings are never pruned automatically.** The persister keeps entries a recording session did not use (`keepUnusedRequests`), so recording one command never deletes what an earlier session captured under the same name. Stale recordings therefore accumulate until you remove them deliberately; see [Workflows](#workflows).

## Workflows

**Record a new case.** Pick a unique `FRODO_TEST_NAME`, run once with `FRODO_MOCK=record FRODO_NO_CACHE=1 ...`, wait for the shutdown countdown, then run again with `FRODO_MOCK=1` to prove it replays with no network.

**Re-record a case.** Run it again in record mode with the same `FRODO_TEST_NAME`. The entries are updated in place.

**Refresh the shared login cassette.** One record run with `FRODO_MOCK_REFRESH_SHARED_AUTH=1` and `FRODO_MOCK_DEPLOYMENT=<type>` (see above).

**Find recordings nothing uses.** Because recordings are never pruned, periodically find the ones no run reads. The reliable way is to log which files a full replay run opens. A preload script that wraps `fs` works, since Polly reads recordings with ordinary file reads:

```javascript
// trace-reads.cjs — run with: NODE_OPTIONS="--require /abs/path/trace-reads.cjs" <your test command>
const fs = require('fs'), path = require('path');
const log = (p) => {
  try {
    const a = path.resolve(String(p));
    if (a.endsWith('.har')) fs.appendFileSync('/tmp/har-reads.log', a + '\n');
  } catch (e) {}
};
for (const n of ['readFile', 'readFileSync', 'open', 'openSync']) {
  const o = fs[n]; fs[n] = function (p, ...r) { log(p); return o.call(this, p, ...r); };
}
const rf = fs.promises.readFile;
fs.promises.readFile = function (p, ...r) { log(p); return rf.call(this, p, ...r); };
```

Every `.har` file that exists but never shows up in the log is a candidate. Before deleting, remove any `skip`/conditional-skip in your tests and run again so recordings that only skipped tests read are not mistaken for orphans, and check that each candidate really is superseded (for example by a renamed test) rather than belonging to a test that fails before it reaches its request.

## Gotchas

- **Record mode keeps the process alive for about 15 seconds after the last request** and prints `Polly instance '...' stopping in Ns...` during the last three. Recordings are written when that countdown ends. Do not kill the process, and do not start another run against the same recordings until it has finished.
- **A run that exits with an error may lose what it recorded.** Make sure the command completes successfully when recording.
- **`recordFailedRequests` is on**, so 4xx/5xx responses are recorded too. That is what lets you test failure paths.
- **One `FRODO_TEST_NAME` per invocation.** Reusing a name overwrites; there is no collision warning.
- **HTTP keep-alive agents are disabled in record mode** so the recording adapter sees every request.
- **Environment inherits into child processes.** If you spawn a tool from a test, it sees your `FRODO_MOCK*` variables. That is intended, but remember to clear or override them when a spawned process should hit the real network.

## In-process helper for Jest tests (frodo-lib's own tests)

frodo-lib's own unit tests do not use the process-wide mechanism above. They use `autoSetupPolly()` from `src/utils/AutoSetupPolly.ts`, which wraps `setup-polly-jest` so each test file records and replays inside the Jest process:

```typescript
import { autoSetupPolly, setDefaultState } from '../utils/AutoSetupPolly';

const ctx = autoSetupPolly();
```

- **Modes** come from `FRODO_POLLY_MODE`: `record` (authenticate against a real environment, then record), `record_noauth` (record without authenticating, for the authentication APIs themselves), or unset (replay). See `npm run test:record`, `test:record_noauth`, `test:update` and `test:only` in `package.json`.
- **Recordings** live in `src/test/mock-recordings/<TestFile>_<hash>/`.
- **Target environment** for recording comes from `FRODO_HOST`, `FRODO_REALM` and `FRODO_DEPLOY` (`classic` switches the defaults from the frodo-dev cloud tenant to the classic host); `setDefaultState()` applies them.
- **Ids that a test creates** can be normalized with `setupPollyRecordingContext()` and its id replacement strategies, so a run that created objects with new ids still matches recordings made with the old ones.
- **Snapshots**: ESM and CJS snapshots are separate; after recording, update the CJS ones with `npm run test:update <name>` as described in the header comment of any `*.test.ts` file in `src/api` (for example `AgentApi.test.ts`).

## Extending the framework

Today the framework is configured only by environment variables, and its extension points (routes, deployment types, replay-time rewrites) live in `SetupPollyForFrodoLib.ts`. If your tool needs something the variables do not cover, the changes belong in frodo-lib rather than in your tool:

- **A new route/area** (a new API family with its own recordings): add a `polly.server.any('<path>').recordingName(...)` next to the existing ones in the host loop.
- **A new deployment type cassette**: see [Shared login cassettes](#shared-login-cassettes).
- **Another response that must change over time** (like the session expiry): add a `beforeReplay` handler on that route.
- **More secrets to mask**: extend `filterRecording()` in `PollyUtils.ts`.

Exporting these as a public, programmatic API would be a natural next step if more tools adopt them.

## Where the code lives

| File | What it holds |
| --- | --- |
| `src/api/BaseApi.ts` | Installs the process-wide hook when `FRODO_MOCK` is set; disables keep-alive agents in record mode. |
| `src/utils/SetupPollyForFrodoLib.ts` | Modes, routing, recording names, hosts, shared login cassettes, replay-time rewrites, expiry, shutdown countdown. |
| `src/utils/PollyUtils.ts` | Matching rules (`defaultMatchRequestsBy`, `orderedMatchRequestsBy`) and secret masking (`filterRecording`). |
| `src/utils/FrodoNodeHttpAdapter.ts` | Node HTTP adapter that strips proxy prefixes from URLs so proxied and direct runs record the same. |
| `src/utils/AutoSetupPolly.ts` | The in-process Jest helper. |
