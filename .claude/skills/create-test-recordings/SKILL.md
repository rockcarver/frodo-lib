---
name: create-test-recordings
description: Record, re-record or review the HTTP recordings (Polly) that frodo-lib's tests replay. Use only when a maintainer asks, for example when a new or changed API call needs a recording, when a recording is missing or stale, or when you must check a recording diff for sensitive data before it is committed. Needs access to a real tenant or server; coding agents without it do not run it.
disable-model-invocation: true
---

**Only run when a maintainer asks. If you are a coding agent without the needed access, stop and say so in the issue or pull request.**

# Create test recordings

frodo-lib's recorded tests replay HTTP traffic captured once from a real environment, so CI needs no tenant. This skill is the procedure for capturing that traffic safely. The full reference for both recording mechanisms is [RECORD_REPLAY.md](../../../RECORD_REPLAY.md); the rule behind it is [decisions/0002](../../../decisions/0002-http-tests-replay-recordings-and-a-missing-recording-fails.md): a request without a recording fails the test, recordings come only from a real recording run, and nobody hand-writes or hand-edits one. The test layout rules are in [tests.instructions.md](../../../.github/instructions/tests.instructions.md). To set up the clone and run tests first, use the build-the-lib skill.

## What you need

- A checkout in a directory named exactly `frodo-lib` (the recordings folder is found through that path segment; a suffixed name reads and writes the recordings of a sibling `frodo-lib` clone if one exists).
- Access to a non-production tenant (cloud) or server (classic) whose data you are allowed to publish. Recording creates and deletes test objects named `FrodoTest...` through the staging helpers in `src/test/setup/` (only in record mode), so use an environment where that is harmless.
- Credentials as environment variables for the single command (`FRODO_USERNAME` and `FRODO_PASSWORD`, or `FRODO_SA_ID` and `FRODO_SA_JWK`), or a connection profile you saved with frodo-cli, whose alias you pass as `FRODO_HOST` (profile lookup read from `getTokens`, not run here). Never put credentials, keys or tokens in a file in the repository, in a shell script you commit, or in a pull request text.

## The modes

frodo-lib's own tests use the in-process helper `autoSetupPolly()` from `src/utils/AutoSetupPolly.ts`, switched by `FRODO_POLLY_MODE`:

| Command                                                         | Mode            | What it does |
| --------------------------------------------------------------- | --------------- | ------------ |
| `npm run test:only -- <path>`                                   | unset: replay   | Replays recordings. A request without one fails the test. Never touches the network. |
| `npm run test:record -- <path>`                                 | `record`        | Logs in against the environment when the helper loads (`getTokens`), then records. Serial (`--runInBand`) and rewrites snapshots (`--updateSnapshot`). |
| `npm run test:record_noauth -- --testPathPatterns <path>`       | `record_noauth` | Records without logging in, for the authentication tests themselves. See the trap below. |
| `npm run test:update -- <path>`                                 | replay          | Rewrites snapshots only. On an unchanged tree it changes nothing (checked). |

Environment variables the helper reads: `FRODO_HOST` (AM URL ending in `/am`, or a profile alias), `FRODO_REALM`, `FRODO_DEPLOY=classic` (switches the defaults from the cloud host and the `alpha` realm to classic ones), `FRODO_RECORD_PHASE` (`1` cloud, `2` classic, in tests that have both groups; read the header comment of the test), `FRODO_POLLY_LOG_LEVEL`, `FRODO_DEBUG=1`.

frodo-lib also has the process-wide mechanism for tools that run the library in their own process (`FRODO_MOCK=record` or `FRODO_MOCK=1`, with `FRODO_TEST_NAME`, `FRODO_MOCK_DIR`, `FRODO_MOCK_HOSTS` and more). frodo-cli's end-to-end tests use it. Everything about it is in RECORD_REPLAY.md. Checked offline: replaying with no recording fails with "Recording for the following request is not found" and names the recording it looked for (`<script>/<test name>/<area>`).

Two traps in the scripts, both checked against a loopback fake server with every change discarded afterwards:

- **`test:record_noauth` swallows a bare path.** The script ends in `--testPathIgnorePatterns cjs`, so `npm run test:record_noauth AuthenticateApi` (as older test headers say) adds your file to the ignore list and runs every other test in record mode, rewriting hundreds of recordings and snapshots. Always pass `--testPathPatterns <file>` as in the table. `test:record` and `test:update` take a plain path.
- **The secret filter is not automatic.** `autoSetupPolly()` does not mask anything. Each recorded test file registers `filterRecording` in a `beforePersist` hook, and registers it only when `FRODO_POLLY_MODE === 'record'`. In a `record_noauth` run of the authentication tests the hook is not registered: the password sent in the login request headers and the returned token id were written unmasked into the recording. Use a throwaway test user whose password you can rotate for such a run, and ask a maintainer before you commit the result.

## Anatomy of a recorded test

```typescript
const ctx = autoSetupPolly();

describe('AgentApi', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });
  // describe and test blocks
});
```

Copy a neighbour (`src/api/AgentApi.test.ts` has the header comment with the whole procedure). A new recorded test file must register the hook, directly or through a helper in `src/test/setup/` or `setupPollyRecordingContext()`.

- **Where recordings go:** `src/test/mock-recordings/<describe>_<hash>/<nested describe>_<hash>/<test title>_<hash>/recording.har`, one folder per level. The folder names come from the `describe` and `test` titles, not from the file name, and the hash is generated by Polly. Never hand-write or rename these folders.
- **Where snapshots go:** `src/test/snapshots/<path of the test file under src/>/<File>.test.js.snap` (for `src/api/AgentApi.test.ts`: `src/test/snapshots/api/AgentApi.test.js.snap`), resolved by `snapshotResolve.js`.
- **Renaming a test or a `describe` title orphans its recording and snapshot.** Checked: renaming one test title made that test fail with "Polly replay integrity check failed" and left one obsolete snapshot. If you must rename, record the test again.
- **Matching** ignores headers and the host name and matches method, path, query and body (`defaultMatchRequestsBy` in `src/utils/PollyUtils.ts`), so a recording made on one tenant replays everywhere. Tests that need request order or no body matching build their own match config (see `src/api/AuthenticateApi.test.ts`).

## Record or re-record

1. Start from a clean tree on a branch: `git status` shows nothing.
2. Replay first, so you know the starting point: `npm run test:only -- <path>`.
3. Record one test file at a time, with the variables for your environment. The tenant URL and credentials below are placeholders:

   ```console
   FRODO_DEBUG=1 FRODO_HOST=https://<tenant-host>/am FRODO_REALM=alpha \
   FRODO_USERNAME=<user> FRODO_PASSWORD='<password>' \
   npm run test:record -- src/api/AgentApi.test.ts
   ```

   Add `-t "<test title>"` to re-record a single test. Tests with phases need one run per phase.
4. If login fails the suite stops at load with "Error getting tokens" and writes nothing (checked with an unreachable host).
5. Update snapshots if the header comment of the test says to: `npm run test:update -- <path>`. There are no separate CJS test folders any more (checked), so the "update the CJS snapshots" step in older headers is only a re-run of this command.
6. Replay: `npm run test:only -- <path>` must pass with no snapshot written, obsolete or updated. Then run the neighbouring suites that share helpers.
7. Review (next section), then commit the recordings and snapshots together with the test change.

If a test needs a new recording and nobody with access is at hand: write the test, say in the pull request that it needs a recording, and stop. Do not copy another recording, do not edit one by hand and do not lower the replay check.

## Review a recording diff before you commit

`git status --short` and `git diff --stat` first: only the recordings and snapshots of the tests you meant to record should have changed. A recording of an unrelated test means the run was too broad: discard and redo it.

`filterRecording` (`src/utils/PollyUtils.ts`) is a denylist. It masks these and nothing else:

- request and response headers: login user name and password, `Authorization`, `Cookie` and `Set-Cookie`, API key and secret, user agent, transaction id, date, etag, `alt-svc`, `via`; response cookies;
- body fields `access_token`, `id_token`, `tokenId`, `accessKey`, the `assertion` of a form post, X.509 certificates in XML, secret-looking variables in script bodies;
- the `host` header is rewritten to the default development host. The host in the request URL is rewritten only when the caller passes `state` (`setupPollyRecordingContext()` does; the plain `filterRecording(recording)` hook most tests use does not), so check the URLs yourself. **Response bodies keep whatever your environment returned.**

Expect these placeholders: `<bearer token>`, `<access token>`, `<id token>`, `<token id>`, `<cookie>`, `<username>`, `<password>`, `<user agent>`, `<transaction id>`, `<date>`, `<etag>`, `<api key>`, `<api secret>`, `<secret>`, `<assertion jwt token>`, `<certificate>`.

Search what you are about to commit, and read the matches:

```console
git diff -U0 -- src/test | grep '^+' | grep -n -i -E 'password|passwd|secret|token|bearer|api[_-]?key|private|BEGIN [A-Z ]*KEY|@[a-z0-9-]+\.[a-z]{2,}|([0-9]{1,3}\.){3}[0-9]{1,3}'
```

Also search for your own tenant host name, tenant id, realm names that are not the defaults, your user name and your e-mail address (`git diff -U0 -- src/test | grep -n -i '<what to look for>'`). Typical misses: secret or key values inside managed objects, OAuth2 client secrets, private keys and certificates outside the masked fields, e-mail addresses and phone numbers of real users, internal host names in redirect URIs and in script bodies, tenant ids in URLs inside response bodies.

If anything sensitive is in the diff, do not commit it, and do not hand-edit the recording (decisions/0002). Extend `filterRecording` (and its tests) in the same pull request and record again, or ask a maintainer. If a secret was ever committed or pasted into a pull request or issue, tell a maintainer so it can be rotated: deleting it from the branch is not enough.

## What to write in the pull request

Which tests were recorded and against what kind of environment (cloud or classic, no names), which snapshot changes are expected and why, and the result of the screen above ("searched the diff for ..., found only placeholders"). Say what was not recorded and why.

## Stop and ask when

- You have no environment you may record against, or it holds data you cannot publish.
- The replay still fails after a clean recording, or a snapshot changed and you cannot say why.
- The filter missed something, or a credential may have reached a file, a log or a pull request text.
- A change would hand-write or hand-edit a recording, or loosen the replay integrity check in `test/jest-polly-replay-integrity.setup.js`.
