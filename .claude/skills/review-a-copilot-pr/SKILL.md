---
name: review-a-copilot-pr
description: Review a pull request written by a coding agent (GitHub Copilot or another) hands-on in frodo-lib, instead of trusting its description or green checks. Use when asked to review, verify or give a verdict on an agent's pull request, to decide whether its workflow runs may be approved, or to word change requests back to the agent. Covers fetching the branch, running it, probing the behaviour, mutation-testing the new tests, comparing with the decision records, and the rules for talking to Copilot.
---

# Review a Copilot pull request hands-on

A plausible description and a green pipeline are not a review. You fetch the branch, read the whole diff, run it and try to break it. You review; a maintainer stays the last lever ([core 0002](../../../decisions/core/0002-a-maintainer-stays-the-last-lever-on-agent-work.md)): you never merge, never approve workflow runs and never post to the pull request unless the maintainer asked you to. The issue and plan gates behind agent work are described in [core 0004](../../../decisions/core/0004-the-repo-concierge-runs-the-issue-plan-and-pr-gates.md); do not add or remove gate labels.

The rules the pull request must follow: [AGENTS.md](../../../AGENTS.md), [CONTRIBUTE.md](../../../CONTRIBUTE.md), the records in [decisions/](../../../decisions/README.md) and the files in [.github/instructions/](../../../.github/instructions/tests.instructions.md). To set up, build and run tests use the build-the-lib skill.

## Rules for dealing with Copilot (read before you touch anything)

- **An `@copilot` mention in any comment starts a new Copilot session.** Use it only for a real change request you want worked on. For a hold, a note or a question to the maintainer use a plain comment without the mention. If a pull request must stop, closing it is the only reliable stop; a "please stop" comment that mentions Copilot starts more work.
- **Check the state before you push or comment:** `gh pr view <N> --json state,isDraft,mergedAt,headRefOid`. The pull request may have been merged, closed or pushed to since you looked. Do not push to an agent's branch while a session may still be running; send a change request or open your own pull request.
- **Workflow runs caused by Copilot's pushes wait for a maintainer's approval** (`action_required`). Only the run of the newest commit matters, after the agent stopped pushing. Older held runs are stale. `Dependabot Auto-Merge` runs on an agent's pull request are no-ops: ignore them.
- **The maintainer approves, not you,** and not before the design is right and every change to a workflow file has been read: the workflow files on the branch are what runs. Never recommend approving runs of a pull request whose design is wrong.
- **Never update snapshots or recordings to get a run green** and never accept that from an agent (decisions/0002).
- **Drafts first.** Write review comments and verdicts as a draft, show it to the maintainer and post only when told to.
- If you used helpers, verify what they report yourself before you pass it on.

## 1. Set up a clean checkout

A separate folder per pull request, with the clone directory named `frodo-lib` (recorded tests find their recordings through that name):

```console
mkdir -p ~/review/pr-<N> && cd ~/review/pr-<N>
git clone https://github.com/rockcarver/frodo-lib.git frodo-lib
cd frodo-lib
git fetch origin pull/<N>/head:pr-<N>
git checkout pr-<N>
npm ci
```

Also read the issue, the plan comment and the pull request description: you are checking the work against what was asked, not against what it says about itself.

## 2. Is it current, and what does it touch?

```console
git rev-list --left-right --count origin/main...pr-<N>     # left number: commits on main the branch lacks
git merge-base --is-ancestor origin/main pr-<N> && echo up-to-date
gh pr diff <N> --name-only
git diff --stat origin/main...pr-<N>
```

If the branch is behind, merge `origin/main` into a scratch branch and run the checks there too, because that is what will land. Then look at what kind of files changed:

| Changed path | What to ask |
| --- | --- |
| `.github/workflows/**`, `.github/scripts/**`, `.github/aw/**`, `.github/*concierge.yml` | An agent's pull request must not edit these (AGENTS.md). Read every line, and say so before anyone approves a run. |
| `package.json`, `package-lock.json`, `tsdown.config.mts`, `scripts/**` | Does `dependencies` stay empty and is a new package really needed? ([dependencies](../../../.github/instructions/dependencies.instructions.md)) |
| `CHANGELOG.md`, `docs/`, `dist/`, `types/` | Generated. They do not belong in a pull request. |
| `src/lib/Help.ts` | Generated from TSDoc (decisions/0003). The diff must follow from the TSDoc diff and nothing else. |
| `src/test/mock-recordings/**`, `src/test/snapshots/**` | Never changed to turn a run green (decisions/0002). Recordings come only from a real recording run: is there a reason and a stated source? Read the diff for sensitive data (create-test-recordings skill). |
| `src/mcp/CapabilityMetadata.ts`, `src/mcp/contract-gap-baseline.json` | The baseline stays `[]` (decisions/0001). Do `mutating` and `riskClass` tell the truth? |
| `decisions/**` | An accepted record is not edited except for typos and for a Known deviations section (a status note, edited in the pull request that fixes the deviation); a changed decision is a new record (record-a-decision skill). |

## 3. Read the whole diff

`git diff origin/main...pr-<N> -- . ':!src/test/mock-recordings' ':!src/test/snapshots'`, then the recordings and snapshots on their own. Questions that find real problems:

- Does it solve the issue, and only that? Unrelated edits, reformatting and drive-by renames are findings.
- Right layer? The library is the brain: logic in `src/ops/`, requests in `src/api/`, nothing tied to a terminal ([core 0001](../../../decisions/core/0001-library-is-the-brain-cli-is-a-thin-wrapper.md)). A new capability goes on the `frodo` facade and is registered in `src/lib/FrodoLib.ts`, never on the package root ([core 0007](../../../decisions/core/0007-public-api-only-through-the-frodo-facade.md), [public-api](../../../.github/instructions/public-api.instructions.md), [ops-modules](../../../.github/instructions/ops-modules.instructions.md)).
- Names follow CRUDQ, otherwise a reviewed metadata entry exists. Every method of the public type has TSDoc and `Help.ts` is regenerated. Errors are `FrodoError` with the cause kept, output goes through `src/utils/Console.ts`. A removed public function has a MIGRATION.md entry.
- Edge cases the author did not think about: empty input, missing realm, classic versus cloud deployment, errors from the server, concurrent calls.
- Design intent that lives in the issue author's head is not in the plan. When the behaviour has more than one reasonable answer, ask the maintainer; do not decide.

## 4. Run it yourself

```console
npm run build
git status --short                      # must be clean: Help.ts regenerated and already committed
npm run check
npx tsc --noEmit
npm run test:only -- <touched modules> --verbose
npm test
```

- Do not copy numbers from the pull request: run the commands. Compare a failure with a clean `origin/main` checkout before you blame the change (caused by the pull request, flaky, or already failing).
- With `--verbose` check that every new test is listed as passed, not skipped or todo. Recorded tests sometimes hide groups behind `FRODO_POLLY_MODE` conditions that are false in replay.
- A test that needs a recording the pull request did not add fails with "Polly replay integrity check failed". That is a real failure: the test needs a maintainer to record it, not a workaround.

## 5. Probe the behaviour for real

Tests passing is the start. Exercise the changed code and try what the pull request claims:

- A throwaway test file next to the module (call it `zzProbe.test.ts`), run with `npm run test:only -- zzProbe`, and delete before you lint or commit anything.
- The built bundle: `node -e "const { frodo } = require('./dist/index.js'); ..."` after `npm run build`.
- HTTP behaviour without a tenant: a loopback `http.createServer` and a `State` pointed at it, the way `src/api/BaseApi.connectionReuse.test.ts` does.
- Reproduce the reported problem on a clean `origin/main` checkout first (it must fail), then on the branch (it must be fixed). If you cannot reproduce it, say so.

## 6. Test the tests

For each new test, break the code it covers and see whether it notices. `mutate.mjs` next to this file applies one small change at a time from a spec that lives outside the repository, runs your test command, restores the file every time (also on Ctrl-C) and reports what survived:

```console
node .claude/skills/review-a-copilot-pr/mutate.mjs /path/to/spec.json
```

```json
{
  "test": "npm run test:only -- src/utils/AsyncUtils.test.ts",
  "mutations": [
    { "name": "always start a new call", "file": "src/utils/AsyncUtils.ts",
      "old": "if (!inFlight) {", "new": "if (true) {" }
  ]
}
```

Pick mutations that change behaviour: flip a condition, drop a branch, return early, change a constant or an error type, swap two arguments. A survivor is a gap: ask for a test that kills it. The script checks that the baseline passes, that every `old` text occurs exactly once, and that `git diff` is clean afterwards (checked on `src/utils/AsyncUtils.ts`: two behaviour changes killed, a comment change survived, the file restored, also after an interrupt).

Then the negative check: revert only the fix, keep the new tests, and rebuild if a test uses `dist/`:

```console
git checkout origin/main -- <the source files of the fix>
npm run test:only -- <the new tests>
git checkout pr-<N> -- <the same files>
```

A source file the pull request adds does not exist on `main`: delete it for the check and bring it back with the second `git checkout`.

The new tests must fail, with the symptom the issue describes and not with an unrelated error. If they stay green they prove nothing.

## 7. CI and the verdict

- `gh pr checks <N>` and `gh run list --branch <head branch> --json databaseId,name,headSha,status,conclusion`. Compare `headSha` with `headRefOid` from `gh pr view`: results on an older commit say nothing about the current one.
- Held runs of the newest commit are the maintainer's to approve once your review is done and you have said what the workflow-file changes (if any) do. State which run, on which commit.
- Write the verdict as a draft: **good to go**, **changes needed** or **do not approve runs yet**. List findings numbered, each with `file:line`, what is wrong, why it matters and how you know (the command you ran). Keep apart what you verified, what you did not (for example the proxy leg of CI, a classic deployment, anything needing a tenant) and what you assumed.
- If changes are needed and the maintainer wants Copilot to make them: one comment with all findings batched and a single `@copilot` mention. Every new mention is a new session and a new set of pushes to review and approve.

## Clean up

Delete the review folder, and check that nothing of yours is left in a shared clone (`git status`, `git stash list`). Never leave a probe file, a mutated source file or a changed recording behind.

## Stop and ask when

- The pull request changes a workflow file, a secret, a recording or a decided behaviour, or contradicts an accepted record.
- The behaviour has two reasonable answers and the issue does not say which.
- You cannot run what the pull request claims (it needs a tenant or a deployment type you do not have): say so and name what stays unverified.
- The pull request was pushed to while you reviewed, or was merged or closed: start again from the current state.
