---
name: record-a-decision
description: Use when a change settles something that will outlive it (a rule contributors must follow, a behaviour users rely on, a design principle), when your task may conflict with an accepted decision record, or when a decision has to be superseded or a typo in a sealed record corrected. Covers where the records are, when a record is warranted, the template and the format, the validator, the one status an agent may write, supersession, errata, deviation entries and the screen for sensitive content.
---

# Record a decision

A decision record says **what was chosen and why**, as a rule that a reviewer can check. Records bind people and coding agents. This skill is the order to work in; the rules themselves are in the `README.md` of the records folder of this repository, in the format page and in the protocol record that the README links. The skill is installed and replaced by Record Keeper, so a change made to it here is lost at the next update.

## 1. Find the records

The folder is the key `folder` in `.github/record-keeper/settings.yml`, and `docs/decisions` when the key is absent. Read its `README.md` (the rules and the index) before you change behaviour that a record may cover. The column `applies-to` of the index says which paths each record binds.

- **An accepted record binds.** A record whose status is `accepted` carries a seal. A `proposed` record binds nobody yet.
- **If your task conflicts with an accepted record, stop and say so** in the issue or pull request. Do not override the record and do not work around it.
- **A pull request that changes a decided behaviour adds a record, or supersedes the old one,** in the same pull request.

## 2. Decide whether a record is warranted

Write one for a decision that outlives the change that prompted it: a rule contributors must follow, a behaviour users rely on, a design principle, a policy. Do not write one for an implementation note, a refactor or a bug fix. When in doubt, ask in the issue.

## 3. Write it

```console
ls docs/decisions                                          # the highest number is the last record
cp docs/decisions/template.md docs/decisions/NNNN-short-title.md
```

Use the folder of the settings instead of `docs/decisions` when the key `folder` is set.

- **File name and number:** `NNNN-short-title.md`, four digits, the next number, lower-case words joined by hyphens. A number is never reused and a record is never deleted, renamed or renumbered.
- **Format:** the front matter keys, the sections and their order, the limit of 60 lines and the rest are on [the format page](https://github.com/gearsnlevers/record-keeper/blob/main/docs/record-format.md). `template.md` is the start.
- **Decision as rules,** in plain language: what is allowed, what is not, and the exceptions. A reviewer must be able to check it.
- **Write what stays true.** State the rule and not a value that changes, leave out "currently", "now" and "the latest", and date a fact that explains the decision.
- **`applies-to`** lists the path globs that the decision binds, preferably folders. Every item of an accepted record must match a file.
- **The status is `proposed`.** You never write `accepted` and you never write a `seal:`: accepting a record is an act of the owners, made in their own pull request ([the design](https://github.com/gearsnlevers/record-keeper/blob/main/docs/design.md#the-protocol)). Say in the pull request that the record is waiting for them.

## 4. Add it to the index

Add a row under "Index" in the `README.md` of the records folder: the number linked to the file, the title and the status exactly as in the record.

## 5. Screen it for sensitive content

A record, its history and its pull request are read by many people.

- No secrets, keys, tokens, passwords, customer or tenant names, private URLs, e-mail addresses or names of people. Roles instead.
- No details of a security weakness, an incident or an unfixed bug.
- **If the decision cannot be written without such detail, stop and ask a maintainer** how to record it.

## 6. Run the validator

```console
node .github/record-keeper/record-keeper.mjs validate
```

Give the folder as an argument when it is not `docs/decisions`. It checks the names and numbers, the front matter, the sections, the length, the credentials and the index. It cannot judge what the record says: that is for the reviewer and the owners. A pull request that touches the records also runs the check `Records integrity`.

## 7. Change a decision

An accepted record is never edited. There are three ways to change what binds, and each needs the owners' approval ([the protocol](https://github.com/gearsnlevers/record-keeper/blob/main/docs/decisions/0001-accepted-records-are-sealed-and-change-only-by-supersession-or-erratum.md)):

- **Supersede it.** Write a new record that lists the record it replaces in `supersedes:`. The old record's status becomes `superseded by NNNN` once the new one is accepted. There is no bare `deprecated`: a decision that is withdrawn without a replacement is superseded by a short record that says why.
- **Correct a typo** (or a broken link) with an erratum. It changes the sealed text, and an erratum that changes more than white space is open for at least 48 hours. It never changes `applies-to`, `repos`, `window` or `supersedes`: that is a new record ([errata and deviations](https://github.com/gearsnlevers/record-keeper/blob/main/docs/errata-and-deviations.md)).
- **Note a known deviation** as an entry in `Known deviations` that cites the issue, pull request or commit of this repository that it excuses.

If you think an accepted record is wrong, do not edit it: propose a new one that supersedes it, or tell the owners.

## Stop and ask when

- your task conflicts with an accepted record;
- you are not sure the decision is the owners' to make;
- the record would need private or sensitive detail to make sense;
- the validator rejects a record and you cannot see why.
