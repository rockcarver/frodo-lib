---
name: change-the-ci-pipeline
description: "Change how frodo-lib's pull request pipeline decides what to run: the code filter (.github/scripts/classify-changes.sh), the Validate guidance job, the Test gate and the other jobs of .github/workflows/pipeline.yml. Use when a new kind of file should skip or start the long test matrix, when a new test reads decision records, skills or Markdown files, when a pull request is slow or unchecked because of its paths, or when someone asks to touch pipeline.yml. A maintainer reads every change to it; coding agents propose, they do not decide."
---

**Only change workflow files when a maintainer asks. If you are a coding agent, stop and say so in the issue or pull request.**

# Change the CI pipeline

`pipeline.yml` builds, tests and releases the library, and a pull request controls the copy of it that runs for that pull request, so a change to it is reviewed line by line. This skill is the order of the steps and the traps. The rules are binding records, which you link and never restate: [core 0012: merging into main is gated by a stable set of required checks](../../../decisions/core/0012-merging-is-gated-by-a-stable-set-of-required-checks.md) and [core 0016: changes that are not code still run the checks that validate them](../../../decisions/core/0016-changes-that-are-not-code-still-run-the-checks-that-validate-them.md). How the jobs fit together is in [PIPELINE.md](../../../PIPELINE.md); the tools underneath are in [BUILD-ENV.md](../../../BUILD-ENV.md).

## How the filter works

1. `Detect code changes` lists the files of the pull request and pipes the names to `.github/scripts/classify-changes.sh`, which prints `code=` and `guidance=`. It runs the copy of the script from the commit the pull request targets, not the one in the pull request.
2. `code=false` skips the `Test` matrix and the cross-platform tests. `Build` always runs.
3. `guidance=true` starts `Validate guidance`, which runs the few tests that read records, skills, instruction files and root Markdown files. It runs also when `code=false`, so those files are still checked.
4. `Test gate` waits for both and fails when the guidance job was wanted and did not succeed, or ran when it was not wanted. The required checks stay `Build`, `Test gate` and the cross-platform check.

The three path lists are `NON_CODE`, `ALWAYS_CODE` and `GUIDANCE` at the top of the script. Nothing else decides what counts as code.

## Rules that do not bend

- No `paths-ignore` on the `pull_request` trigger. A required check that never runs stays "expected" and blocks the merge.
- The filter can only skip work, never hide it. An empty list, 3000 or more entries, an API error, a missing script, a push, a manual run: all count as code. Keep every new branch of the script and the step failing towards `code=true`.
- Do not rename a required check (`Build`, `Test gate`, `Cross-Platform Tests (Credential File Permissions)`) and do not add a new required one. Either needs a ruleset change only a maintainer can make; change the matrix or add a job behind `Test gate` instead.
- `pipeline.yml` and the classifier count as code, so a pull request that changes them runs everything.
- Change `PIPELINE.md` and `BUILD-ENV.md` in the same pull request.

## Recipes

**A new kind of file skips the long matrix** (a new documentation folder, say). Add its pattern to `NON_CODE`, add a row for it and a row for a look-alike that must stay code to `src/classifyChanges.test.ts`, and update the list in `PIPELINE.md`. If a test reads that kind of file, also do the next recipe.

**A new test reads decisions, skills, `AGENTS.md` or another non-code file.** Add the test to the list of the `Validate guidance` job in `pipeline.yml`, add the path to `GUIDANCE` if it is not covered, and add a fixture row. `src/pipelineWorkflow.test.ts` fails until the job lists every such test, so you cannot forget the first part. The test must run on the sources without a build: a test that needs `dist/` never goes in this job.

**A change to the test matrix** (a Node version, a service container). Edit the `test` job only. `Test gate` hides the matrix names from the ruleset, so no setting changes.

**Anything else** (secrets, permissions, the release jobs, `workflow_dispatch` inputs). Stop and ask a maintainer in the issue or pull request first.

## Check it

```console
npm run test:only -- --runTestsByPath src/classifyChanges.test.ts src/pipelineWorkflow.test.ts
shellcheck .github/scripts/classify-changes.sh
npm run check
```

- The first command runs the classifier against fixture lists, runs the real shell of the classify step and of `Test gate` with every combination of job results, and checks the guidance job's list. Run `shellcheck` if it is installed; the script must also run under the bash 3.2 of macOS.
- Try a list by hand: `printf 'decisions/README.md\nAGENTS.md\n' | bash .github/scripts/classify-changes.sh` prints two lines.
- Mutation-test what you change: break one rule in the script or the gate (swap a `true`, drop a path) and see that a test fails, then restore it. A test that stays green proves nothing.
- `actionlint` is not part of this repository. If you have it, run it on `pipeline.yml`.

## Prove it in CI, after the merge

A pull request that edits `pipeline.yml` or the script is classified as code, and the classifier comes from the target branch, so the pull request that adds or changes the filter never shows its own effect. Check it once it is merged:

1. Open a draft pull request that changes only one skill file. Expect `Detect code changes` success, `Test` skipped, `Validate guidance` success, `Test gate` success.
2. Push a deliberate error (a `npm run` script that does not exist, in a skill). Expect `Validate guidance` and `Test gate` to fail and `Build` to pass.
3. Close the draft and delete its branch. Do not approve or delete anyone else's runs.

## Traps

- `.github/scripts/` is also where the Repo Concierge installs its scripts. `classify-changes.sh` is ours; an update only touches the files in its own manifest, and you never edit those (see [AGENTS.md](../../../AGENTS.md)).
- The files API lists a renamed file under both names (`previous_filename`). Keep reading both, or moving code into `docs/` hides it.
- `Test gate` must run when a job it needs is skipped: keep `if: ${{ !cancelled() }}`.
- A skill may cite any file in the repository, and `src/agentSkills.test.ts` checks that it exists. A non-code pull request that deletes a cited workflow file passes the filter and is caught only by the next code change. Say so in the pull request instead of widening the guidance list for it.
- Release commits are pushes, not pull requests, and always count as code.
- Never approve the workflow runs of your own pipeline change; the maintainer does, after reading the diff.

## Done when

The fixture tests and `npm run check` pass, the docs match the workflow, a maintainer has read the workflow diff, and after the merge the draft pull request above behaved as described.
