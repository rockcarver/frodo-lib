#!/usr/bin/env bash
# Classifies the files of a pull request for .github/workflows/pipeline.yml.
#
# Reads the changed file names on stdin, one per line (a renamed file is listed
# under both its old and its new name), and prints two lines:
#
#   code=<true|false>      false only when the long test matrix can be skipped:
#                          every file is non-code and none is one of the files
#                          that must always count as code
#   guidance=<true|false>  true when a file changed that a validation test reads
#                          (records, skills, instruction files, root Markdown), so
#                          the fast "Validate guidance" job has to run
#
# It can only skip work, never hide it (record 0012): an empty list, 3000 or
# more entries (the files API stops there) and every file not on the non-code
# list count as code. See PIPELINE.md and record 0016.
#
# This file is not part of the Repo Concierge: it belongs to this repository,
# although it sits in a folder the concierge also installs files into.
set -euo pipefail

MAX_FILES=3000

# Files that change no behaviour and no build: skipping the test matrix for a
# pull request made only of these is safe. Anything not listed is code.
NON_CODE='^(docs/|[^/]+\.md$|LICENSE$|decisions/|\.claude/skills/|\.github/(ISSUE_TEMPLATE/|agentic-workflows/|aw/|concierge\.yml$|instructions/|scripts/|workflows/[^/]+\.(ya?ml|md)$|CODEOWNERS$|dependabot\.yml$|copilot-instructions\.md$))'

# Non-code by the list above, but code anyway: they decide what runs, so a pull
# request that changes them must run everything.
ALWAYS_CODE='^(\.github/workflows/pipeline\.yml|\.github/scripts/classify-changes\.sh)$'

# Files read by a validation test: src/agentSkills.test.ts reads the skills,
# AGENTS.md and every repository path a skill cites; src/decisionRecords.test.ts
# reads decisions/ (core records included), the core records drift check and its
# workflow; src/index.test.ts reads CONTRIBUTE.md. Root Markdown covers the entry
# points and the documents skills link; add a path here, in the same pull
# request, when a new test reads a new kind of file.
GUIDANCE='^(decisions/|\.claude/skills/|\.github/instructions/|\.github/scripts/check-core-records-drift\.mjs$|\.github/workflows/core-records-drift\.yml$|[^/]+\.md$)'

count=0
code=false
guidance=false

while IFS= read -r file || [ -n "${file}" ]; do
  [ -n "${file}" ] || continue
  count=$((count + 1))
  if [[ ${file} =~ ${ALWAYS_CODE} ]] || [[ ! ${file} =~ ${NON_CODE} ]]; then
    code=true
  fi
  if [[ ${file} =~ ${GUIDANCE} ]]; then
    guidance=true
  fi
done

if [ "${count}" -eq 0 ] || [ "${count}" -ge "${MAX_FILES}" ]; then
  code=true
fi

echo "code=${code}"
echo "guidance=${guidance}"
