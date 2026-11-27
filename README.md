# Record Keeper log

Written by the audit of this repository (run-audit.mjs), never by hand.

- `incidents.jsonl`: one JSON document on each line for every incident issue that the audit opened, changed, reopened or closed.
- `announcements.jsonl`: one JSON document on each line for every announcement issue that the audit opened; the first announcement makes the file.
- `last-run.json`: the record of the last run of the audit.

The history of this branch is not to be rewritten. The audit does not read it back: it judges the history of the default branch again at every run.
