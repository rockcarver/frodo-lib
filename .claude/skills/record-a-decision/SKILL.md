---
name: record-a-decision
description: Write, supersede or index a decision record for frodo-lib. Use when a change introduces or reverses a lasting rule that contributors and coding agents must follow, when a pull request conflicts with an accepted record, or when someone asks to document why something is the way it is. This repository's records live in decisions/ at the repository root.
---

# Record a decision

A decision record says why we chose something and what follows from it. It is not a how-to: procedures live in skills like this one, and a skill links the records it must obey. The rules for records are in [decisions/README.md](../../../decisions/README.md); this skill is the order of the steps and the traps.

## Is it a record?

Write one for a lasting decision: something a maintainer would be surprised to see reversed without discussion, such as a layering rule, a naming rule, how tests treat recordings, what a gate does. Do not write one for a bug fix, a routine refactor, an implementation note or a one-off choice.

Where it goes:

- Concerns only frodo-lib: here, in `decisions/` at the repository root. The other repositories keep records in a `decisions` folder inside `docs`; here `docs/` is typedoc output that `npm run doc` wipes (checked), so the folder moved up.
- Spans frodo-lib, frodo-cli or the Homebrew tap: in the umbrella repository, [rockcarver/frodo](https://github.com/rockcarver/frodo/tree/main/docs/decisions). Read its README there for the steps, the `repos:` front matter key and its validator command. Do not copy a cross-repo record into this folder.
- Not sure: ask a maintainer in the issue or pull request before you write it.

## Steps

1. **Read first.** Open the index in `decisions/README.md` and the records near your change. If your task conflicts with an accepted record, stop and say so in the issue or pull request, unless replacing that record is the whole point of the change and a maintainer asked for it. The binding cross-repo records are listed in [AGENTS.md](../../../AGENTS.md).
2. **Pick the number.** The next one after the highest in `decisions/`, four digits. Numbers must be unique and contiguous from `0001`.
3. **Copy the template.** `cp decisions/template.md decisions/NNNN-short-title.md`. The file name is lower case with hyphens and says what was decided (`0002-http-tests-replay-recordings-and-a-missing-recording-fails.md`).
4. **Fill in the front matter.** Only these keys are accepted:
   - `status:` `proposed`, `accepted`, `rejected`, `deprecated` or `superseded by NNNN`. Write `proposed` unless a maintainer told you the decision is already taken; a proposed record is not binding, a maintainer accepts it.
   - `date:` a real `YYYY-MM-DD` date.
   - `decision-makers:` a list, normally `maintainers`. No personal names or e-mail addresses.
   - `applies-to:` path globs the decision governs, where that helps (`src/mcp/**`).
   - `issues:` related issues as `owner/repo#123`.
   - `repos:` is accepted but not required in this repository.

   Lists are `- item` lines under the key. No other key, no repeated key, no inline lists.
5. **Write the body.** A `# Title` line, then `## Context and problem statement` (what forced the decision, two or three sentences), `## Decision` (the rules a contributor or agent can follow, with paths in backticks) and `## Consequences` (what changes, what gets harder, what to watch). Optional, in this order after those: `## Known deviations` (where reality does not match yet) and `## Alternatives considered`. Aim for under 40 lines; 60 is the hard limit. Each section needs content.
6. **Index it.** Add a row to the table in `decisions/README.md`: `| 0004 | [Title](0004-short-title.md) | proposed |`. The status text in the row must match the record's status exactly.
7. **Superseding.** A changed decision is a new record. In the old record change only the status to `superseded by NNNN` (the one edit allowed besides typos), update its index row, and say in the new record's context what changed and why. Never edit an accepted record's decision, and never renumber.
8. **Make it findable.** If the record binds agents, add it to the `Decisions` section of `AGENTS.md` once it is accepted. If a rule needs a checklist at edit time, put the checklist in the matching file under `.github/instructions/` and link the record instead of copying the rule, so the rule lives in one place.
9. **Check.**

   ```console
   npm run test:only -- src/decisionRecords.test.ts
   node scripts/validate-decision-records.mjs decisions
   ```

   Both run the same validator (checked: a copy of the template left unfilled fails with a bad date and a missing index row; the unchanged folder passes). It checks the file name, numbers, front matter, the three sections in order, status values, the index rows and links, length, and obvious credential shapes. It cannot judge the content, so do the screen below yourself.

## Sensitivity screen

Records are public. Before you commit, read your text for:

- credentials, keys, tokens and tenant or host names;
- how a security problem was found, reproduced or exploited: record the rule that follows from it, not the incident;
- names, e-mail addresses or other personal information of people, and anything said in private;
- internal chat, tickets or links a reader cannot open.

If the reason for a decision is sensitive, state the rule and leave the reason out, or ask a maintainer how to word it. The validator only recognises a few credential shapes.

## The pull request

- The pull request that changes a decided behaviour contains the record that adds or supersedes it. A record about work that is not in the pull request goes in its own pull request.
- One record per decision. Say in the description which decision it is, which issue it comes from and what it replaces.
- The maintainer accepts. Do not merge or flip a status to `accepted` yourself unless a maintainer asked for exactly that.

## Stop and ask when

- Your change contradicts an accepted record.
- You are not sure whether the decision binds this repository only or several.
- The reasoning you would have to write down is sensitive.
- The validator fails in a way you cannot explain: do not weaken `scripts/validate-decision-records.mjs` or the checks in `src/decisionRecords.test.ts` to get a pass. The script is a copy of the one the other repositories use.
