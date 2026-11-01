---
name: release-the-lib
description: Use when a maintainer wants to release frodo-lib, to check that a release worked, or to complete a release whose Release job failed after the package was published. Covers the checks before dispatching the pipeline, the dispatch, what to verify afterwards on npm and GitHub, what to do when the run fails, and the hand-over to the CLI pin.
disable-model-invocation: true
---

**Only run when a maintainer asks. If you are a coding agent without the needed access, stop and say so in the issue or pull request.**

# Release the library

A release publishes a package other people install, so a maintainer starts it by hand and merging never releases: [core 0005: releases are started by a maintainer through the pipeline](../../../decisions/core/0005-releases-are-started-by-a-maintainer-through-the-pipeline.md), and [core 0002: a maintainer stays the last lever on agent work](../../../decisions/core/0002-a-maintainer-stays-the-last-lever-on-agent-work.md). A bad release is fixed forward with a new one. How the jobs work is in [PIPELINE.md](../../../PIPELINE.md); this skill is the order of the steps and the traps.

## Before you dispatch

- Every pull request meant for this release is merged, and the pipeline run for the **last commit on `main`** passed: `gh run list -R rockcarver/frodo-lib --workflow pipeline.yml --branch main --limit 3`.
- **No release run is in progress, and nobody merges into `main` while one is.** The `Release` job commits the version, the changelog and the docs on top of the commit the run was dispatched from; a merge in between makes its push fail after the package is already on npm. The first step of `npm-release` stops the run when `main` has moved, but it cannot cover a merge in the last minutes before the push. Check `gh run list -R rockcarver/frodo-lib --workflow pipeline.yml --event workflow_dispatch --limit 3`, and tell everyone who can merge, other agent sessions included.
- You know which kind it is: `prerelease` (npm tag `next`), `premajor` (starts the `X.0.0-1` train of the next major), `patch`, `minor` or `major` (stable goes to `latest`, with a companion prerelease on `next`). The next version is computed from the latest tag, not from `package.json`.
- After a change to `.github/workflows/pipeline.yml` itself, run a dry run first (`-f dry-run=true`: everything except the publish, the tag, the commit and the GitHub release).

## Dispatch

```console
gh workflow run pipeline.yml -R rockcarver/frodo-lib --ref main -f release-type=prerelease -f dry-run=false
gh run list -R rockcarver/frodo-lib --workflow pipeline.yml --event workflow_dispatch --limit 1
```

Always pass `release-type`: the default `ci-only` runs the validation and publishes nothing. The run builds, runs the tests on Node 22, 24 and 26, the cross-platform tests, publishes to npm, generates the changelog, commits and tags, and creates the GitHub release; it takes about five to ten minutes. Do not merge anything into `main` meanwhile.

## Verify

When every job succeeded:

- **npm:** `npm view @rockcarver/frodo-lib dist-tags --json`. A prerelease moves `next`; a stable release moves `latest`. The publish log of `npm-release` says `+ @rockcarver/frodo-lib@<version>`; if the tag has not moved yet, that is npm holding a new version in "Validating" for 25 minutes to about four hours, not a failure. `npm view @rockcarver/frodo-lib@<version> version` answers 404 meanwhile. Do not dispatch again.
- **GitHub:** `gh release view v<version> -R rockcarver/frodo-lib` shows a pre-release for a prerelease, with `CHANGELOG.md`, `LICENSE` and `Release.txt` (the commit the run built). The tag `v<version>` is annotated. `main` has the commit `Updated changelog, version, and docs for release v<version> [skip ci]`.
- **Pages:** the `Doc` job deploys the typedoc output after a real release.

## When the run fails

- **Before `npm-release` published:** read the failed job, fix the cause, dispatch again. Nothing is left to clean up. If the first step of `npm-release` ("Refuse to publish when the branch has moved") failed, `main` moved during the run: dispatch again when nothing is being merged.
- **After `npm-release` published and the `Release` job failed:** **never dispatch again.** The base of the next version is the latest tag, so the run would try to publish the same version, and npm refuses. "Re-run failed jobs" helps only when the failure was transient (a missing or expired `FRODO_CI_PAT` secret, a flaky step): it starts from the dispatched commit again, so a push rejected because `main` moved is rejected again. Complete the release by hand with the recipe in [PIPELINE.md](../../../PIPELINE.md), section "The package is published but the Release job failed": the `build` artifact of the run, a release pull request, the annotated tag, the GitHub release. The changelog step needs the pipeline's model key and cannot be re-run, so the changelog entry is written by hand from the merged pull requests.
- **Do not unpublish or delete a tag** unless the maintainer says so: [PIPELINE.md](../../../PIPELINE.md) ("Recovering From A Bad Release") says how.

## Hand-over to the CLI

A CLI change that needs the new library waits for it. Once npm shows the version, the pin pull request in frodo-cli is the `pin-the-library` skill ([frodo-cli](https://github.com/rockcarver/frodo-cli/blob/main/.claude/skills/pin-the-library/SKILL.md)), and the release of the CLI is `release-the-cli` ([frodo-cli](https://github.com/rockcarver/frodo-cli/blob/main/.claude/skills/release-the-cli/SKILL.md)).

Stop and report when the maintainer's go is unclear. A fragment such as "cut a release and pin it" in a conversation is a note, not a go.
