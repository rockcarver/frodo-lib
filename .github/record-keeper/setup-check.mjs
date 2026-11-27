// Record Keeper, the setup check: tells a repository when its installation of the kit is incomplete or wrong (docs/setup-check.md).
//
// One file, no dependencies. It reads the files of the working tree (the settings, the pin, CODEOWNERS, the installed files) and, with the read-only token of the
// workflow, GitHub (the rules of the default branch, the accounts of the owners, the pinned release and the last run of the audit). It writes nothing anywhere
// but the job summary: no issue, no comment, no branch. It prints annotations (and, outside Actions, plain lines) and fails only when the audit is dead or the
// check `Records integrity` is not required.
//
//   node setup-check.mjs --repo <owner/name>             read the working tree and GitHub
//   node setup-check.mjs --local                         read the working tree only; what GitHub holds is said to be not checked
//   options: --root <dir> (the working tree, default .), --now <time> (YYYY-MM-DDTHH:MM:SSZ, for tests), --json (print the result as JSON)
//
// The token is read from GITHUB_TOKEN (the token of the workflow), the repository from GITHUB_REPOSITORY and the address of the API from GITHUB_API_URL (default
// https://api.github.com). RECORD_KEEPER_TOKEN is never read or sent: the workflow says only whether it is set, in HAS_RECORD_KEEPER_TOKEN. Exit status: 0 when
// no finding is an error, 1 when one is, 2 when the run could not be made or the command line is wrong.
//
// The file is in two parts. The first is pure: it takes what was read, as plain data, and returns the findings (reference/setup_ref.py is a second implementation
// of it). The second part is the runner: files and HTTP.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS_PATH, WORKFLOW_FILES, parseSettings } from './record-keeper.mjs';
import {
  AGENTS_PATH, BLOCK_WHY, DEFAULT_API, PIN_PATH, TIMEOUT_MS, Failed, Refused, apiBase, checkManifest, downloadManifest, inspect, inspectAgents, isSource, listReleases, nextPage, parseManifest, parsePin, printable, readBlock, readPin,
  redact, request, usableReleases, wait,
} from './updater.mjs';
import { LOG_BRANCH } from './run-audit.mjs';

export const CHECK = 'Records integrity';
export const SECRET = 'RECORD_KEEPER_TOKEN';
export const AUDIT_WORKFLOW = '.github/workflows/records-audit.yml';
export const CODEOWNERS_PLACES = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];
/** The files that CODEOWNERS must give an owner (docs/design.md): the settings, the pin and the workflows of the kit. */
export const COVERED = [SETTINGS_PATH, PIN_PATH, ...WORKFLOW_FILES];
export const MAX_AGE_MS = 48 * 3600 * 1000;
export const SKEW_MS = 5 * 60 * 1000;
export const BOUNDS = { settings: 64 * 1024, codeowners: 1024 * 1024, record: 64 * 1024, answer: 1024 * 1024, accounts: 30, rulesets: 10, pages: 5, perPage: 100, pattern: 300, parts: 12, list: 8 };

const USAGE = `Usage:
  setup-check.mjs --repo <owner/name> [--root <dir>] [--now <time>] [--json]
  setup-check.mjs --local [--root <dir>] [--now <time>] [--json]
`;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The findings. A finding is { code, severity, detail }: the code is what the page lists, the detail is the thing it names, and the text is made from both.

export const SEVERITY = {
  'audit-dead': 'error',
  'check-not-required': 'error',
  'check-not-strict': 'warning',
  'bypass-always': 'warning',
  'codeowners-missing': 'warning',
  'codeowners-uncovered': 'warning',
  'owners-few': 'warning',
  'owner-mismatch': 'warning',
  'managed-differs': 'warning',
  'block-unusable': 'warning',
  'manifest-unreadable': 'warning',
  'pin-missing': 'warning',
  'pin-unusable': 'warning',
  'settings-missing': 'warning',
  'settings-unusable': 'warning',
  'secret-not-set': 'warning',
  'audit-workflow-missing': 'warning',
  'audit-record-unreadable': 'warning',
  'audit-record-future': 'warning',
  'single-owner': 'notice',
  'audit-not-yet': 'notice',
  'not-checked': 'notice',
};

/** The codes of every finding that the page lists. */
export const CODES = Object.keys(SEVERITY);

/** What a check that was not made was to look at, by topic, and the step that fixes it. */
export const TOPICS = {
  github: { what: `what GitHub holds: the rules of the default branch, the accounts of the owners, the pinned release and the last run of the audit`, fix: `Run it without --local, in the workflow or with a token that can read the repository.` },
  repository: { what: `the default branch, its rules and the last run of the audit`, fix: `Check that the token of the workflow can read the repository (the workflow asks for contents: read), and run it again.` },
  rules: { what: `the rules that apply to the default branch`, fix: `Read them under Settings, Rules, Rulesets: a ruleset on the default branch must require the check "${CHECK}". Run the check again later if GitHub was busy.` },
  'branch protection': { what: `whether branch protection requires the check, which no ruleset does`, fix: `Read it under Settings, Branches, or put the rule into a ruleset (Settings, Rules, Rulesets), which the check reads. Run the check again later if GitHub was busy.` },
  strict: { what: `whether the check must be up to date`, fix: `Branch protection does not tell the token of the workflow. Move the rule into a ruleset, which the check reads, or read the setting under Settings, Branches.` },
  bypass: { what: `who may bypass the ruleset`, fix: `The ruleset could not be read. Run the check again later, and read it under Settings, Rules, Rulesets if it keeps failing: no actor may bypass except for pull requests.` },
  accounts: { what: `the accounts of the owners`, fix: `Read https://api.github.com/user/<id> for each owner and compare the login, or run the check again later.` },
  codeowners: { what: `who CODEOWNERS gives the files of the kit to`, fix: `Write CODEOWNERS with the patterns that docs/setup-check.md says are read, or read the file by hand.` },
  release: { what: `the manifest of the pinned release`, fix: `Run the check again later. The release is read from the repository named in the pin.` },
  secret: { what: `whether ${SECRET} is set`, fix: `Run the workflow on its schedule or by hand: it says whether the secret is set (HAS_RECORD_KEEPER_TOKEN).` },
  audit: { what: `the last run of the audit`, fix: `Run the check again later, and look at the branch record-keeper/log by hand.` },
  age: { what: `how long the audit workflow has been in the repository`, fix: `Run the check again later, and look at the history of ${AUDIT_WORKFLOW} by hand.` },
};

/**
 * What the check does not look at, because nothing that the repository does would let it: not a finding and no annotation, but said in the job summary and in `--json`
 * (and, outside Actions, in one plain line). `why` is made by the decision.
 */
export const NOT_LOOKED_AT = {
  bypass: { what: `who may bypass the ruleset`, note: `The token of a workflow is not shown the bypass list of a ruleset, whoever the repository is. The audit finds the effect (a change to a guarded file that came in without a pull request is a violation, A-03), and run by hand with the token of a person who may administer the repository the program says bypass-always.` },
  own: { what: `the pin, the pinned release and the installed files`, note: `The kit does not install itself.` },
  secret: { what: `whether ${SECRET} is set`, note: `The run of a pull request from a fork is given no secret, so what it would say is not what the repository has. The scheduled run and a manual run of the workflow say it when the secret is not set.` },
};

const TEXT = {
  'audit-dead': (d) => `the audit is not running: ${d}. Open the runs of the workflow "Records audit", run it by hand and read its log, and make sure the workflow is enabled.`,
  'check-not-required': (d, severity) => (severity === 'notice'
    ? `the check "${CHECK}" is not required on the default branch (${d}), and that is expected on the pull request of a first adoption: this pull request installs the kit, and the ruleset that requires the check is set after it is merged, because a required check that the base branch cannot run would hold the pull request for ever. After the merge, add the check to the ruleset of the default branch (Settings, Rules, Rulesets) and require branches to be up to date (docs/install.md of the kit, first adoption).`
    : `the check "${CHECK}" is not required on the default branch (${d}): no rule that applies to it requires the check, so a pull request can be merged without it. Add the check to the ruleset of the default branch (Settings, Rules, Rulesets) and require branches to be up to date.`),
  'check-not-strict': (d) => `the check "${CHECK}" is required on ${d}, but no rule that requires it also requires branches to be up to date. Turn on "Require branches to be up to date before merging" in that rule.`,
  'bypass-always': (d) => `an actor may skip the rule that requires "${CHECK}" and push to the default branch directly (${d}). Set its bypass mode to "For pull requests only", or remove it.`,
  'codeowners-missing': () => `there is no CODEOWNERS file (.github/CODEOWNERS, CODEOWNERS or docs/CODEOWNERS). Add one that gives an owner to the settings file, the pin and the workflow files of the kit.`,
  'codeowners-uncovered': (d) => `CODEOWNERS gives no owner to ${d}. Add an entry for them (for example "/.github/" and the owners) so that a ruleset can require the review of a code owner.`,
  'owners-few': (d) => `the settings list fewer owners than approvals needs (${d}), so an act cannot be approved. List more owners in .github/record-keeper/settings.yml.`,
  'owner-mismatch': (d) => `an owner of the settings is not the account that GitHub knows (${d}). Correct the entry in .github/record-keeper/settings.yml: the ID decides and the login must be the current one.`,
  'managed-differs': (d) => `files that the kit installed differ from the pinned release: ${d}. Run the updater with --target set to the pinned version to bring them back, or restore them.`,
  'block-unusable': (d) => `the Record Keeper block in ${AGENTS_PATH} cannot be used (${Object.hasOwn(BLOCK_WHY, d) ? BLOCK_WHY[d] : d}), so the updater leaves the file alone and the agents may read old rules, or none. Repair or take out the two marker lines and the text between them by hand, and run the updater with --target set to the pinned version (docs/agent-files.md of the kit).`,
  'manifest-unreadable': (d) => `the pinned release has no manifest that can be read (${d}), so the installed files cannot be compared with it. Check the pin, and that the release still exists.`,
  'pin-missing': () => `there is no pin (.github/record-keeper.yml), so the updater has no release to keep this repository on. Adopt a release with the updater (docs/updater.md of the kit).`,
  'pin-unusable': (d) => `the pin cannot be used (${d}), so the updater will not update this repository. Fix .github/record-keeper.yml in a pull request (docs/updater.md of the kit).`,
  'settings-missing': () => `there is no settings file (.github/record-keeper/settings.yml), so no owner is known and no act can be approved. Create it with the owners (docs/settings.md of the kit).`,
  'settings-unusable': (d) => `the settings file cannot be used (${d}), and the kit reads the default for what it cannot read. Fix .github/record-keeper/settings.yml (docs/settings.md of the kit).`,
  'secret-not-set': () => `the secret ${SECRET} is not set, so the updater cannot open pull requests. Create it as docs/updater.md of the kit says.`,
  'audit-workflow-missing': (d) => `the audit workflow ${AUDIT_WORKFLOW} is ${d === '' ? 'not in this checkout' : 'not a file'}, so nothing runs the nightly audit. Restore it with the updater.`,
  'audit-record-unreadable': (d) => `last-run.json on the branch ${LOG_BRANCH} cannot be read (${d}), so the age of the last audit run is not known. Run the workflow "Records audit" by hand: it replaces the file.`,
  'audit-record-future': (d) => `last-run.json on the branch ${LOG_BRANCH} says the audit ran at ${d}, which is in the future. Look at the file and at the clock of the runner.`,
  'single-owner': () => `this pull request puts the single-owner mode on, or changes who the owners are while it is on (approvals: 1). The owner is the whole authority: the checks keep the records in order and stop contributors, agents and forgetfulness, but not the owner, nor whoever holds the owner's token. The delays and the audit still apply.`,
  'audit-not-yet': (d) => `${d}. The audit writes its record on every push to the default branch and every night, so this goes away by itself; look at the workflow "Records audit" if it does not.`,
};

/** The sentence that says a finding. A text that came from a remote place is written so that no control character can hide in it. */
export function describe({ code, severity, detail }) {
  if (code !== 'not-checked') return TEXT[code](printable(detail), severity);
  const at = detail.indexOf(': ');
  const topic = detail.slice(0, at);
  return `not checked: ${TOPICS[topic].what} (${printable(detail.slice(at + 2))}). ${TOPICS[topic].fix}`;
}

/** The sentence that says what is not looked at: `{ topic, why }` as `decide` gives it. */
export const describeLooked = ({ topic, why }) => `not looked at: ${NOT_LOOKED_AT[topic].what} (${printable(why)}). ${NOT_LOOKED_AT[topic].note}`;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Times

const UTC = /^(19[7-9]\d|[2-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)Z$/;

/** The milliseconds of a UTC time written YYYY-MM-DDTHH:MM:SSZ (a real time, from the year 1970), or null when the text is not one. */
export function parseUtc(text) {
  if (typeof text !== 'string') return null;
  const found = UTC.exec(text);
  if (found === null) return null;
  const at = Date.UTC(Number(found[1]), Number(found[2]) - 1, Number(found[3]), Number(found[4]), Number(found[5]), Number(found[6]));
  return new Date(at).toISOString() === `${text.slice(0, -1)}.000Z` ? at : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// CODEOWNERS: the part of its syntax that is read (docs/setup-check.md)

const OWNER = /^(?:@[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\/[A-Za-z0-9._-]{1,100})?|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)$/;

/** Why a pattern is not read, or null when it is. */
function patternProblem(pattern) {
  if (Array.from(pattern).length > BOUNDS.pattern) return 'a pattern longer than 300 characters';
  if (pattern.startsWith('!')) return 'a pattern that starts with !';
  if (/[\\[\]?]/.test(pattern)) return 'a pattern with \\, [, ] or ?';
  const rest = pattern.replace(/^\//, '').replace(/\/$/, '');
  if (rest === '') return 'a pattern with no name';
  const parts = rest.split('/');
  if (parts.includes('')) return 'a pattern with an empty part';
  if (parts.length > BOUNDS.parts) return 'a pattern with more than 12 parts';
  if (parts.some((part) => part.includes('**') && part !== '**')) return 'a pattern with ** inside a name';
  return null;
}

/** Reads the text of a CODEOWNERS file: { rules: [{ line, pattern, owners }], unreadable: [{ line, reason }] }. The line number counts from 1. */
export function parseCodeowners(text) {
  const rules = [];
  const unreadable = [];
  for (const [index, raw] of text.split('\n').entries()) {
    const words = (raw.endsWith('\r') ? raw.slice(0, -1) : raw).split(/[ \t]+/).filter((word) => word !== '');
    if (words.length === 0 || words[0].startsWith('#')) continue;
    const comment = words.findIndex((word, at) => at > 0 && word.startsWith('#'));
    const owners = (comment < 0 ? words : words.slice(0, comment)).slice(1);
    const bad = owners.find((owner) => !OWNER.test(owner));
    const reason = patternProblem(words[0]) ?? (bad === undefined ? null : 'an owner that is not @name, @org/team or an e-mail address');
    if (reason !== null) unreadable.push({ line: index + 1, reason });
    else rules.push({ line: index + 1, pattern: words[0], owners });
  }
  return { rules, unreadable };
}

/** Whether a pattern of CODEOWNERS (one that `patternProblem` accepts) matches a path: the rules of .gitignore, as GitHub reads them (docs/setup-check.md). */
export function matches(pattern, file) {
  const anchored = pattern.startsWith('/');
  const folder = pattern.endsWith('/');
  const parts = pattern.replace(/^\//, '').replace(/\/$/, '').split('/');
  const names = file.split('/');
  const wild = parts.at(-1).includes('*');
  const known = new Map();
  const segment = (glob, text) => {
    let [g, t, star, mark] = [0, 0, -1, 0];
    while (t < text.length) {
      if (g < glob.length && glob[g] === '*') {
        star = g++;
        mark = t;
      } else if (g < glob.length && glob[g] === text[t]) {
        g++;
        t++;
      } else if (star >= 0) {
        g = star + 1;
        t = ++mark;
      } else return false;
    }
    while (g < glob.length && glob[g] === '*') g++;
    return g === glob.length;
  };
  const from = (p, n) => {
    const key = `${p}:${n}`;
    if (known.has(key)) return known.get(key);
    let found;
    if (p === parts.length) found = folder ? n < names.length : n === names.length || !wild;
    else if (parts[p] === '**') found = p === parts.length - 1 ? n < names.length : names.slice(n).concat('').some((_, skip) => from(p + 1, n + skip));
    else found = n < names.length && segment(parts[p], names[n]) && from(p + 1, n + 1);
    known.set(key, found);
    return found;
  };
  if (anchored || parts.length > 1) return from(0, 0);
  return names.some((_, start) => from(0, start));
}

/** The owners that CODEOWNERS gives a path: those of the last pattern that matches it (none when no pattern does, or when that pattern lists none). */
export function ownersOf(rules, file) {
  const last = rules.findLast((rule) => matches(rule.pattern, file));
  return last === undefined ? [] : last.owners;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The decision

const compare = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const lowerAscii = (text) => text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
const SEVERITIES = ['error', 'warning', 'notice'];
/** The owners as a list of `login/id` in the order of their bytes, so that two lists of the same owners are the same text. */
const ownerList = (owners) => owners.map((owner) => `${owner.login}/${owner.id}`).sort(compare).join(',');

/**
 * What the setup check says: the findings, errors first and each group in the order the checks are made, the topics that were checked and found fine, and what was not
 * looked at (a topic and why: no finding, and no annotation). `input` is
 * what the runner read, as plain data (the page and test/fixtures/setup/README.md say what each part is): `now` in milliseconds, `local`, `own` (the kit's own
 * repository), `event`, `secretSet` (true, false or null), `settings`, `baseSettings` (the settings of the base of a pull request), `basePin` (whether the base of a pull
 * request has a pin, as `{ state }` with `absent`, `present` or `not-read`; left out when it was not asked for, which is the same as `not-read`), `codeowners`, `pin`, `release`,
 * `tree`, `auditWorkflow` and `github` (null with `local`).
 */
export function decide(input) {
  const found = [];
  const passed = [];
  const notLookedAt = [];
  const add = (code, detail = '', severity = SEVERITY[code]) => found.push({ code, severity, detail });
  const unchecked = (topic, why) => add('not-checked', `${topic}: ${why}`);
  const { settings, github, local, now } = input;

  // The settings, and what follows from the owners that they list.
  const known = settings.state === 'read';
  if (settings.state === 'absent') add('settings-missing');
  else if (settings.state === 'unreadable') add('settings-unusable', 'not a regular file of text');
  else if (settings.problems.length > 0) {
    const [first] = settings.problems;
    add('settings-unusable', `${first.rule}${first.line === null ? '' : ` at line ${first.line}`}${settings.problems.length > 1 ? ` and ${settings.problems.length - 1} more` : ''}`);
  } else passed.push('settings');
  if (known) {
    if (settings.owners.length < settings.approvals) add('owners-few', `${settings.owners.length} listed, ${settings.approvals} needed`);
    else passed.push('owners');
    // The single-owner mode is said once, by the pull request that puts it on or changes its owners (on every other run nobody could do anything about it, and the audit
    // announces the change to the owners): when the settings of its head say approvals 1 and those of its base did not exist, said another number or listed other owners.
    // Settings of the base that could not be read, or were not asked for, say nothing.
    const base = input.baseSettings;
    if (settings.approvals === 1 && input.event === 'pull_request' && (base.state === 'absent' || (base.state === 'read' && (base.approvals !== 1 || ownerList(base.owners) !== ownerList(settings.owners))))) add('single-owner');
  }

  // The accounts of the owners.
  if (!local && known && settings.owners.length > 0) {
    const asked = settings.owners.slice(0, BOUNDS.accounts);
    const unread = [];
    let wrong = 0;
    for (const owner of asked) {
      const account = github.accounts[String(owner.id)];
      const who = `${owner.login}/${owner.id}`;
      if (account === undefined || !account.ok) unread.push(`${who}: ${account === undefined ? 'not read' : account.why}`);
      else if (account.login === null) {
        wrong++;
        add('owner-mismatch', `${who}: no account has this ID`);
      } else if (lowerAscii(account.login) !== lowerAscii(owner.login)) {
        wrong++;
        add('owner-mismatch', `${who}: GitHub says ${account.login}`);
      }
    }
    if (settings.owners.length > asked.length) unread.push(`${settings.owners.length - asked.length} more owners`);
    if (unread.length > 0) unchecked('accounts', unread.join('; '));
    else if (wrong === 0) passed.push('owner-accounts');
  }

  // CODEOWNERS.
  const { codeowners } = input;
  if (codeowners.state === 'absent') add('codeowners-missing');
  else if (codeowners.state === 'unreadable') unchecked('codeowners', `${codeowners.path} is not a small file of text`);
  else {
    const { rules, unreadable } = parseCodeowners(codeowners.text);
    if (unreadable.length > 0) unchecked('codeowners', `${codeowners.path} line ${unreadable[0].line}: ${unreadable[0].reason}`);
    else {
      const bare = COVERED.filter((file) => ownersOf(rules, file).length === 0);
      if (bare.length > 0) add('codeowners-uncovered', bare.join(', '));
      else passed.push('codeowners');
    }
  }

  // The rules of the default branch.
  const release = input.release;
  if (local) unchecked('github', 'the command line says --local');
  else if (!github.repo.ok) unchecked('repository', github.repo.why);
  else if (!github.rules.ok) unchecked('rules', github.rules.why);
  else {
    const { branch } = github.repo;
    const requiring = github.rules.rules.filter((rule) => rule.checks.includes(CHECK));
    const classic = github.classic.ok && github.classic.requires;
    // No ruleset requires the check. That is an error only when branch protection, the other way to require it, could be read and does not either: a read that failed is
    // a notice, never an error.
    if (requiring.length === 0 && !github.classic.ok) unchecked('branch protection', github.classic.why);
    else if (requiring.length === 0 && !classic) {
      // On the pull request that installs the kit (the head has a pin and the base has none) the ruleset cannot be set yet: a required check that the base cannot run would hold
      // the pull request for ever, so it is set after the merge, and the finding is expected there: a notice. A base that has a pin, or that could not be asked, leaves it an error.
      const installing = input.event === 'pull_request' && input.pin.state !== 'absent' && input.basePin?.state === 'absent';
      add('check-not-required', branch, installing ? 'notice' : SEVERITY['check-not-required']);
    }
    else {
      passed.push('check-required');
      const strict = release.state === 'read' && release.upToDate !== null ? release.upToDate : true;
      if (requiring.length === 0) unchecked('strict', 'the check is required by branch protection, and not by a ruleset');
      else if (strict && requiring.some((rule) => rule.strict)) passed.push('check-strict');
      else if (strict) add('check-not-strict', branch);
      const unseen = [];
      const hidden = [];
      let always = 0;
      for (const id of [...new Set(requiring.map((rule) => rule.id))].sort((a, b) => a - b)) {
        const ruleset = github.bypass[String(id)];
        if (ruleset === undefined || !ruleset.ok) unseen.push(`ruleset ${id}: ${ruleset === undefined ? 'not read' : ruleset.why}`);
        else if (ruleset.actors === null) hidden.push(`ruleset ${id}: the token cannot see the bypass list`);
        else {
          for (const actor of ruleset.actors.filter((item) => item.mode !== 'pull_request')) {
            always++;
            add('bypass-always', `${ruleset.name}: ${actor.type} ${actor.id === null ? 'without an ID' : actor.id}, mode ${actor.mode}`);
          }
        }
      }
      if (unseen.length > 0) unchecked('bypass', unseen.join('; '));
      if (hidden.length > 0) notLookedAt.push({ topic: 'bypass', why: hidden.join('; ') });
      if (unseen.length === 0 && hidden.length === 0 && always === 0 && requiring.length > 0) passed.push('bypass');
    }
  }

  // The pin, the pinned release, the files that were installed, and the secret.
  const { pin } = input;
  if (input.own) notLookedAt.push({ topic: 'own', why: 'this is the repository of the kit: install.json is at its root' });
  else if (pin.state === 'absent') add('pin-missing');
  else if (pin.state === 'refused') add('pin-unusable', pin.code);
  else {
    passed.push('pin');
    if (!local) {
      if (release.state === 'not-checked') unchecked('release', release.why);
      else if (release.state === 'unlisted') add('manifest-unreadable', `${pin.version} is not in the list of releases of ${pin.source}`);
      else if (release.state === 'no-asset') add('manifest-unreadable', `${pin.version} has no release-manifest.json`);
      else if (release.state === 'refused') add('manifest-unreadable', `${pin.version}: ${release.code}`);
      else {
        passed.push('manifest');
        // The managed files and the block of AGENTS.md are compared by SHA-256 and size. A block is the text between the markers, so the file can be missing, can have no block, can have
        // a block that differs (all of them `managed-differs`: the updater brings them back), or can have markers that cannot be used (`block-unusable`: the updater leaves such a file alone).
        const differing = [];
        const unusable = [];
        const entries = [...release.files, ...release.blocks].sort((a, b) => compare(a.path, b.path));
        for (const file of entries) {
          const here = Object.hasOwn(input.tree, file.path) ? input.tree[file.path] : { kind: 'absent' };
          if (here.kind === 'absent') differing.push(`${file.path} (missing)`);
          else if (here.kind === 'large') unusable.push('too-large');
          else if (here.kind === 'block') {
            if (here.state === 'none') differing.push(`${file.path} (block missing)`);
            else if (here.state === 'refused') unusable.push(here.why);
            else if (here.sha256 !== file.sha256 || here.size !== file.size) differing.push(`${file.path} (block differs)`);
          } else if (here.kind !== 'file') differing.push(`${file.path} (not a file)`);
          else if (here.sha256 !== file.sha256 || here.size !== file.size) differing.push(`${file.path} (differs)`);
        }
        if (differing.length === 0 && unusable.length === 0) passed.push('managed-files');
        if (differing.length > 0) add('managed-differs', `${differing.slice(0, BOUNDS.list).join(', ')}${differing.length > BOUNDS.list ? `, and ${differing.length - BOUNDS.list} more` : ''}`);
        for (const why of unusable) add('block-unusable', why);
        if (release.secrets.includes(SECRET)) {
          if (input.event === 'pull_request') notLookedAt.push({ topic: 'secret', why: 'a run for a pull request is not given the secrets' });
          else if (input.secretSet === null) unchecked('secret', 'the workflow did not say whether it is set');
          else if (input.secretSet) passed.push('secret');
          else add('secret-not-set');
        }
      }
    }
  }

  // The audit: its workflow, and its last run.
  if (!local && github.repo.ok) {
    const file = input.auditWorkflow === 'file';
    if (file) passed.push('audit-workflow');
    else add('audit-workflow-missing', input.auditWorkflow === 'absent' ? '' : 'not a file');
    const last = github.lastRun;
    if (!last.ok) unchecked('audit', last.why);
    else if (last.state === 'unreadable') add('audit-record-unreadable', last.why);
    else if (last.state === 'record') {
      const at = parseUtc(last.at);
      if (at === null) add('audit-record-unreadable', 'at is not a UTC time');
      else if (at - now > SKEW_MS) add('audit-record-future', last.at);
      else if (now - at > MAX_AGE_MS) add('audit-dead', `the last run was at ${last.at}, more than two days ago`);
      else passed.push('audit');
    } else if (file) {
      const age = github.age;
      const since = age !== undefined && age.ok && age.at !== null ? parseUtc(age.at) : null;
      if (age === undefined || !age.ok) unchecked('age', age === undefined ? 'not read' : age.why);
      else if (age.at === null) add('audit-not-yet', 'there is no record of a run, and the audit workflow is not on the default branch yet');
      else if (since === null) unchecked('age', 'the date of the first commit is not a UTC time');
      else if (now - since > MAX_AGE_MS) add('audit-dead', `there is no record of a run, and the audit workflow has been in the repository since ${age.at}`);
      else add('audit-not-yet', `there is no record of a run yet, and the audit workflow is on the default branch since ${age.at}`);
    }
  }

  const findings = SEVERITIES.flatMap((severity) => found.filter((finding) => finding.severity === severity));
  return { findings, passed, notLookedAt };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// What is printed

/** The text of a message of a workflow command: the escapes that GitHub documents, after every control character has been written as text. */
export const escapeData = (text) => printable(text).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
/** The text of a property of a workflow command: as the data, and the two characters that end a property. */
export const escapeProperty = (text) => escapeData(text).replaceAll(':', '%3A').replaceAll(',', '%2C');

/** A finding as the workflow command that GitHub shows as an annotation. */
export const annotation = (finding) => `::${finding.severity} title=${escapeProperty(finding.code)}::${escapeData(describe(finding))}`;

const count = (number, one, many) => `${number} ${number === 1 ? one : many}`;
/** The one line that ends the output: how many findings of each severity there are. */
export const tally = (findings) => `setup check: ${SEVERITIES.map((severity, at) => count(findings.filter((finding) => finding.severity === severity).length, severity, ['errors', 'warnings', 'notices'][at])).join(', ')}`;

/** A text of a finding as Markdown that cannot make a link, an image, a mention or a table of its own. */
export const markdown = (text) => printable(text).replace(/[\\`*_{}[\]()#+\-.!|<>&@~:]/g, (character) => `\\${character}`);

/** The job summary: a table of the findings, what was checked and found fine, and what was not looked at. */
export function summary(result, { repo, at }) {
  const lines = [`## Records setup check`, '', `${repo === null ? 'The working tree' : `\`${repo}\``} at ${at}: **${tally(result.findings).slice('setup check: '.length)}**`, ''];
  if (result.findings.length === 0) lines.push('No finding.', '');
  else {
    lines.push('| Severity | Code | What |', '| -------- | ---- | ---- |');
    for (const finding of result.findings) lines.push(`| ${finding.severity} | \`${finding.code}\` | ${markdown(describe(finding))} |`);
    lines.push('');
  }
  lines.push(`Checked, and fine: ${result.passed.length === 0 ? 'nothing' : result.passed.map((topic) => `\`${topic}\``).join(', ')}.`, '');
  if (result.notLookedAt.length > 0) {
    lines.push('Not looked at, and nothing that this repository can do about it:', '');
    for (const item of result.notLookedAt) lines.push(`- \`${item.topic}\`: ${markdown(describeLooked(item))}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** The command line. Returns the options, or null when it is not one. */
export function parseArgs(argv) {
  const options = { root: '.', repo: null, local: false, now: null, json: false };
  const flags = { '--local': 'local', '--json': 'json' };
  const values = { '--root': ['root', (value) => typeof value === 'string' && value !== '' && !value.startsWith('--')], '--repo': ['repo', isSource], '--now': ['now', (value) => parseUtc(value) !== null] };
  const given = new Set();
  for (let at = 0; at < argv.length; at++) {
    const name = argv[at];
    if (given.has(name)) return null;
    given.add(name);
    if (Object.hasOwn(flags, name)) options[flags[name]] = true;
    else if (Object.hasOwn(values, name) && values[name][1](argv[at + 1])) options[values[name][0]] = argv[++at];
    else return null;
  }
  return options;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The runner: the working tree

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The bytes of a file, or null when it is larger than `limit`. The file was looked at before: it is a regular file. */
function readUpTo(file, limit) {
  const handle = fs.openSync(file, 'r');
  try {
    const bytes = Buffer.alloc(limit + 1);
    const got = fs.readSync(handle, bytes, 0, limit + 1, 0);
    return got > limit ? null : bytes.subarray(0, got);
  } finally {
    fs.closeSync(handle);
  }
}

/** The text of CODEOWNERS: UTF-8, with no control character but the tab and the line ends, or null. */
function textOf(bytes) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029\ufeff]/.test(text) ? null : text;
  } catch {
    return null;
  }
}

function readSettingsFile(root) {
  const here = inspect(root, SETTINGS_PATH);
  if (here.kind === 'absent') return { state: 'absent' };
  const bytes = here.kind === 'file' ? readUpTo(path.join(root, SETTINGS_PATH), BOUNDS.settings) : null;
  if (bytes === null) return { state: 'unreadable' };
  const { settings, problems } = parseSettings(bytes);
  if (problems.some(({ rule }) => rule === 'S-02')) return { state: 'unreadable' };
  return { state: 'read', problems: problems.map(({ rule, line }) => ({ rule, line })), owners: settings.owners, approvals: settings.approvals };
}

function readCodeowners(root) {
  for (const place of CODEOWNERS_PLACES) {
    const here = inspect(root, place);
    if (here.kind === 'absent') continue;
    const bytes = here.kind === 'file' ? readUpTo(path.join(root, place), BOUNDS.codeowners) : null;
    const text = bytes === null ? null : textOf(bytes);
    return text === null ? { state: 'unreadable', path: place } : { state: 'read', path: place, text };
  }
  return { state: 'absent', path: '' };
}

function readPinFile(root) {
  try {
    const text = readPin(root);
    return text === null ? { state: 'absent' } : { state: 'read', ...parsePin(text) };
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    return { state: 'refused', code: error.code };
  }
}

/** What the working tree holds at a path of the manifest: { kind: 'absent' | 'file' | 'other', sha256, size }. */
function readInstalled(root, relative) {
  const here = inspect(root, relative);
  if (here.kind === 'absent') return { kind: 'absent' };
  if (here.kind !== 'file') return { kind: 'other' };
  return { kind: 'file', sha256: here.sha256, size: fs.statSync(path.join(root, relative)).size };
}

/**
 * What the working tree holds at the path of a block: { kind: 'absent' | 'other' | 'large' } as for a file, or { kind: 'block', state } for a file that was read: `none` (no markers),
 * `refused` (with `why`, the reason of `readBlock`) or `one` (with the SHA-256 and the size of the text between the markers, the markers included).
 */
function readInstalledBlock(root) {
  const here = inspectAgents(root);
  if (here.kind === 'absent' || here.kind === 'large') return { kind: here.kind };
  if (here.kind !== 'file') return { kind: 'other' };
  const found = readBlock(here.bytes);
  if (found.state === 'none') return { kind: 'block', state: 'none' };
  if (found.state === 'refused') return { kind: 'block', state: 'refused', why: found.why };
  const block = here.bytes.subarray(found.start, found.end);
  return { kind: 'block', state: 'one', sha256: createHash('sha256').update(block).digest('hex'), size: block.length };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The runner: GitHub

const BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;
/** Whether a name is a branch that the check will put into a request: no empty part, no part that walks out of the path, and no hyphen first (git has no such branch). */
const isBranch = (name) => typeof name === 'string' && BRANCH.test(name) && !name.startsWith('-') && name.split('/').every((part) => part !== '' && !part.includes('..') && part !== '.');
const LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?$/;
const encoded = (name) => name.split('/').map(encodeURIComponent).join('/');
const isCount = (value) => Number.isSafeInteger(value) && value > 0;

/** The JSON that an answer holds, at most `BOUNDS.answer` bytes of it. Throws Failed. */
async function getJson(context, route, ok = [200]) {
  const answer = await request(context, 'GET', route, { ok, limit: BOUNDS.answer });
  const where = printable(route.slice(0, 120));
  if (answer.over) throw new Failed(`the answer to ${where} is larger than the check takes`);
  if (answer.status === 404) return { status: 404, body: null, headers: answer.headers };
  try {
    return { status: answer.status, body: JSON.parse(answer.bytes.toString('utf8')), headers: answer.headers };
  } catch {
    throw new Failed(`the answer to ${where} is not JSON`);
  }
}

/** Runs a read that may fail: { ok: true, ...what it gives }, or { ok: false, why }. */
async function reading(read) {
  try {
    return { ok: true, ...(await read()) };
  } catch (error) {
    if (!(error instanceof Failed)) throw error;
    return { ok: false, why: error.message };
  }
}

const notWhat = (what) => new Failed(`the answer about ${what} is not what the check needs`);

async function readRepo(context, repo) {
  const { body } = await getJson(context, `/repos/${repo}`);
  if (!isObject(body) || !isBranch(body.default_branch)) throw notWhat('the repository');
  return { branch: body.default_branch };
}

/** The rules that require a status check, from every page of the rules that apply to the branch: [{ id, checks, strict }]. */
async function readRules(context, repo, branch) {
  const rules = [];
  const seen = new Set();
  let route = `/repos/${repo}/rules/branches/${encoded(branch)}?per_page=${BOUNDS.perPage}`;
  while (route !== null) {
    if (seen.size === BOUNDS.pages) throw new Failed(`more than ${BOUNDS.pages} pages of rules`);
    seen.add(route.startsWith('http') ? route : context.base + route);
    const { body, headers } = await getJson(context, route);
    if (!Array.isArray(body)) throw notWhat('the rules');
    for (const rule of body) {
      if (!isObject(rule) || typeof rule.type !== 'string') throw notWhat('the rules');
      if (rule.type !== 'required_status_checks') continue;
      const wanted = rule.parameters?.required_status_checks;
      if (!isCount(rule.ruleset_id) || !Array.isArray(wanted) || !wanted.every((item) => isObject(item) && typeof item.context === 'string')) throw notWhat('the rules');
      rules.push({ id: rule.ruleset_id, checks: wanted.map((item) => item.context), strict: rule.parameters.strict_required_status_checks_policy === true });
    }
    route = nextPage(context, headers.get('link'), seen);
  }
  return { rules };
}

/** Whether branch protection (not a ruleset) requires the check: { requires }. */
async function readClassic(context, repo, branch) {
  const { body } = await getJson(context, `/repos/${repo}/branches/${encoded(branch)}`);
  const protection = isObject(body) ? body.protection : undefined;
  if (!isObject(protection) || typeof protection.enabled !== 'boolean') throw notWhat('branch protection');
  if (!protection.enabled) return { requires: false };
  const wanted = protection.required_status_checks;
  if (!isObject(wanted) || typeof wanted.enforcement_level !== 'string' || !Array.isArray(wanted.contexts) || !Array.isArray(wanted.checks)) throw notWhat('branch protection');
  const named = wanted.contexts.includes(CHECK) || wanted.checks.some((item) => isObject(item) && item.context === CHECK);
  return { requires: wanted.enforcement_level !== 'off' && named };
}

/** The bypass list of a ruleset: { name, actors }, where `actors` is null when the token was not shown the list. */
async function readRuleset(context, repo, id) {
  const { body } = await getJson(context, `/repos/${repo}/rulesets/${id}`);
  if (!isObject(body) || typeof body.name !== 'string') throw notWhat(`the ruleset ${id}`);
  const name = Array.from(body.name).slice(0, 80).join('');
  if (body.bypass_actors === undefined) return { name, actors: null };
  const listed = body.bypass_actors;
  if (!Array.isArray(listed) || !listed.every((item) => isObject(item) && typeof item.actor_type === 'string' && typeof item.bypass_mode === 'string' && (item.actor_id === null || isCount(item.actor_id)))) throw notWhat(`the ruleset ${id}`);
  return { name, actors: listed.map((item) => ({ type: item.actor_type, id: item.actor_id, mode: item.bypass_mode })) };
}

/** The login of the account with an ID: { login }, or { login: null } when there is none. */
async function readAccount(context, id) {
  const { status, body } = await getJson(context, `/user/${id}`, [200, 404]);
  if (status === 404) return { login: null };
  if (!isObject(body) || body.id !== id || typeof body.login !== 'string' || !LOGIN.test(body.login)) throw notWhat(`the account ${id}`);
  return { login: body.login };
}

/** The record of the last run of the audit, or what is wrong with it. `at` is the text that it says, null when it says none. */
async function readLastRun(context, repo) {
  const answer = await request(context, 'GET', `/repos/${repo}/contents/last-run.json?ref=${encodeURIComponent(LOG_BRANCH)}`, { accept: 'application/vnd.github.raw+json', ok: [200, 404], limit: BOUNDS.record });
  if (answer.status === 404) return { state: 'absent' };
  const bad = (why) => ({ state: 'unreadable', why });
  if (answer.over) return bad('larger than 64 KiB');
  let record;
  try {
    record = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(answer.bytes));
  } catch {
    return bad('not JSON in UTF-8');
  }
  if (!isObject(record) || !Object.hasOwn(record, 'at')) return bad('not an object with an at');
  return { state: 'record', at: typeof record.at === 'string' ? record.at : null };
}

/** The time of the oldest commit of the default branch that touches the audit workflow, as the API writes it, or null when none does. */
async function readAge(context, repo, branch) {
  let oldest = null;
  for (let page = 1; page <= BOUNDS.pages; page++) {
    const { body } = await getJson(context, `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(AUDIT_WORKFLOW)}&per_page=${BOUNDS.perPage}&page=${page}`);
    if (!Array.isArray(body)) throw notWhat('the history of the audit workflow');
    if (body.length > 0) oldest = body.at(-1);
    if (body.length === BOUNDS.perPage) continue;
    if (oldest === null) return { at: null };
    const date = oldest?.commit?.committer?.date;
    if (typeof date !== 'string') throw notWhat('the history of the audit workflow');
    return { at: date };
  }
  throw new Failed(`more than ${BOUNDS.pages * BOUNDS.perPage} commits touch ${AUDIT_WORKFLOW}`);
}

/**
 * The settings file at the base branch of a pull request, for the one finding that compares it with the head's: { state: 'absent' } when there is none, { state: 'read',
 * owners, approvals } when there is one, and { state: 'not-read' } when it could not be read (and then nothing is said).
 */
async function readBase(context, repo, base) {
  try {
    const answer = await request(context, 'GET', `/repos/${repo}/contents/${encoded(SETTINGS_PATH)}?ref=${encodeURIComponent(base)}`, { accept: 'application/vnd.github.raw+json', ok: [200, 404], limit: BOUNDS.settings });
    if (answer.status === 404) return { state: 'absent' };
    if (answer.over) return { state: 'not-read' };
    const { settings, problems } = parseSettings(answer.bytes);
    return problems.some(({ rule }) => rule === 'S-02') ? { state: 'not-read' } : { state: 'read', owners: settings.owners, approvals: settings.approvals };
  } catch (error) {
    if (!(error instanceof Failed)) throw error;
    return { state: 'not-read' };
  }
}

/**
 * Whether the base branch of a pull request has a pin, for the one finding that is a notice on the pull request that installs the kit: { state: 'absent' } on a 404,
 * { state: 'present' } when there is something at the path, and { state: 'not-read' } when the read failed (and then the finding stays an error).
 */
async function readBasePin(context, repo, base) {
  try {
    const answer = await request(context, 'GET', `/repos/${repo}/contents/${encoded(PIN_PATH)}?ref=${encodeURIComponent(base)}`, { accept: 'application/vnd.github.raw+json', ok: [200, 404], limit: BOUNDS.record });
    return { state: answer.status === 404 ? 'absent' : 'present' };
  } catch (error) {
    if (!(error instanceof Failed)) throw error;
    return { state: 'not-read' };
  }
}

/** The manifest of the pinned release of the source, read as untrusted data: what the check needs of it, or why not. */
async function readRelease(context, pin) {
  try {
    const releases = usableReleases(await listReleases(context, pin.source));
    const release = releases.find((item) => item.tag_name === pin.version);
    if (release === undefined) return { state: 'unlisted' };
    const bytes = await downloadManifest(context, pin.source, release);
    if (bytes === null) return { state: 'no-asset' };
    const manifest = parseManifest(bytes);
    checkManifest(manifest, { tag: pin.version, commit: pin.commit });
    const rule = manifest.requires.rulesets.find((item) => item.branch === 'default');
    const listed = (kind) => manifest.files.filter((file) => file.kind === kind).map(({ path: where, sha256, size }) => ({ path: where, sha256, size }));
    return { state: 'read', secrets: manifest.requires.secrets, upToDate: rule === undefined ? null : rule['up-to-date'], files: listed('managed'), blocks: listed('block') };
  } catch (error) {
    if (error instanceof Refused) return { state: 'refused', code: error.code };
    if (!(error instanceof Failed)) throw error;
    return { state: 'not-checked', why: error.message };
  }
}

/** Everything that GitHub holds that the decision reads, as the readings that `decide` takes. */
async function readGithub(context, { repo, owners, pin, last }) {
  const github = { repo: await reading(() => readRepo(context, repo)) };
  const found = { github, release: { state: 'not-checked', why: 'not read' } };
  if (github.repo.ok) {
    const { branch } = github.repo;
    github.rules = await reading(() => readRules(context, repo, branch));
    github.classic = await reading(() => readClassic(context, repo, branch));
    github.bypass = {};
    if (github.rules.ok) {
      const carrying = github.rules.rules.filter((rule) => rule.checks.includes(CHECK)).map((rule) => rule.id);
      for (const id of [...new Set(carrying)].sort((a, b) => a - b).slice(0, BOUNDS.rulesets)) github.bypass[String(id)] = await reading(() => readRuleset(context, repo, id));
    }
  }
  github.accounts = {};
  for (const owner of owners.slice(0, BOUNDS.accounts)) github.accounts[String(owner.id)] = await reading(() => readAccount(context, owner.id));
  if (pin !== null) found.release = await readRelease(context, pin);
  if (github.repo.ok) {
    github.lastRun = await reading(() => readLastRun(context, repo));
    if (github.lastRun.ok && github.lastRun.state === 'absent' && last) github.age = await reading(() => readAge(context, repo, github.repo.branch));
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The run

/** One run: reads, decides, and returns { findings, passed, repo, at } or throws Failed. */
async function execute(opts, env, options) {
  const root = path.resolve(opts.root);
  const repo = opts.repo ?? env.GITHUB_REPOSITORY;
  if (!opts.local && !isSource(repo)) throw new Failed('the repository must be owner/name (--repo, or GITHUB_REPOSITORY)');
  const token = env.GITHUB_TOKEN === undefined || env.GITHUB_TOKEN === '' ? undefined : env.GITHUB_TOKEN;
  if (token !== undefined && !/^\S+$/.test(token)) throw new Failed('GITHUB_TOKEN is not a token');
  const now = opts.now === null ? (options.now ?? Date.now)() : parseUtc(opts.now);
  const context = { base: apiBase(env.GITHUB_API_URL || DEFAULT_API), token, fetch: options.fetch ?? globalThis.fetch, sleep: options.sleep ?? wait, timeout: options.timeout ?? TIMEOUT_MS, agent: 'record-keeper-setup-check' };

  const input = {
    now,
    local: opts.local,
    own: inspect(root, 'install.json').kind === 'file',
    event: env.GITHUB_EVENT_NAME || null,
    secretSet: env.HAS_RECORD_KEEPER_TOKEN === 'true' ? true : env.HAS_RECORD_KEEPER_TOKEN === 'false' ? false : null,
    settings: readSettingsFile(root),
    baseSettings: { state: 'not-read' },
    codeowners: readCodeowners(root),
    pin: readPinFile(root),
    auditWorkflow: { absent: 'absent', file: 'file' }[inspect(root, AUDIT_WORKFLOW).kind] ?? 'other',
    release: { state: 'not-checked', why: '--local' },
    tree: {},
    github: null,
  };
  if (!opts.local) {
    const asked = input.settings.state === 'read' ? input.settings.owners : [];
    const found = await readGithub(context, { repo, owners: asked, pin: input.own || input.pin.state !== 'read' ? null : input.pin, last: input.auditWorkflow === 'file' });
    input.github = found.github;
    input.release = found.release;
    if (input.release.state === 'read') input.tree = Object.fromEntries([...input.release.files.map((file) => [file.path, readInstalled(root, file.path)]), ...input.release.blocks.map((file) => [file.path, readInstalledBlock(root)])]);
    // The runner of GitHub names the branch that a pull request goes into in GITHUB_BASE_REF, and only for a pull request. It is asked for only when it can change the answer.
    if (input.event === 'pull_request' && input.settings.state === 'read' && input.settings.approvals === 1 && isBranch(env.GITHUB_BASE_REF)) input.baseSettings = await readBase(context, repo, env.GITHUB_BASE_REF);
  }
  let result = decide(input);
  // The base of a pull request is asked for its pin only when the answer changes one finding: a pull request into the default branch that has a pin of its own, and
  // for which `check-not-required` would be an error. The base that has none makes that finding a notice; any other answer, or none, leaves it an error.
  if (input.event === 'pull_request' && !opts.local && input.pin.state !== 'absent' && isBranch(env.GITHUB_BASE_REF) && input.github.repo.ok && env.GITHUB_BASE_REF === input.github.repo.branch
    && result.findings.some(({ code, severity }) => code === 'check-not-required' && severity === 'error')) {
    input.basePin = await readBasePin(context, repo, env.GITHUB_BASE_REF);
    result = decide(input);
  }
  return { ...result, repo: opts.local ? null : repo, at: new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z') };
}

/** The command line, without the process around it. Returns { code, stdout, stderr }. `options` replaces what a test must: `fetch`, `sleep`, `timeout` and `now`. */
export async function runCli(argv, env, options = {}) {
  const opts = parseArgs(argv);
  if (opts === null) return { code: 2, stdout: '', stderr: USAGE };
  const secrets = [env.GITHUB_TOKEN, env.RECORD_KEEPER_TOKEN];
  try {
    const done = await execute(opts, env, options);
    // The token is taken out of what a remote place said before the text is made, so that no text of any kind (a line, a JSON document, a Markdown table) holds it.
    const result = { ...done, findings: done.findings.map((finding) => ({ ...finding, detail: redact(finding.detail, secrets) })), notLookedAt: done.notLookedAt.map((item) => ({ ...item, why: redact(item.why, secrets) })) };
    const findings = result.findings.map((finding) => ({ ...finding, text: describe(finding) }));
    const looked = result.notLookedAt.map((item) => ({ ...item, text: describeLooked(item) }));
    let stdout;
    if (opts.json) stdout = `${JSON.stringify({ repository: result.repo, at: result.at, findings, passed: result.passed, notLookedAt: looked })}\n`;
    else {
      // In Actions a finding is an annotation, and what is not looked at is in the summary and in --json only: nobody who reads the run could do anything about it.
      const actions = env.GITHUB_ACTIONS === 'true';
      const lines = findings.map((finding) => (actions ? annotation(finding) : `${finding.severity}: [${finding.code}] ${printable(finding.text)}`));
      if (!actions) lines.push(...looked.map((item) => printable(item.text)));
      stdout = `${lines.map((line) => `${line}\n`).join('')}${tally(findings)}\n`;
    }
    let stderr = '';
    if (env.GITHUB_STEP_SUMMARY) {
      try {
        fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary(result, { repo: result.repo, at: result.at })}\n`);
      } catch (error) {
        stderr = `setup-check: the job summary could not be written: ${printable(error.code ?? 'an error')}\n`;
      }
    }
    return { code: findings.some((finding) => finding.severity === 'error') ? 1 : 0, stdout: redact(stdout, secrets), stderr: redact(stderr, secrets) };
  } catch (caught) {
    // A file that cannot be read is a failure of the run, said in a line, and not a stack; so is a mistake of the program itself, whose status must not be 1, the status of
    // a finding that is an error.
    let message;
    if (caught instanceof Failed) message = caught.message;
    else if (caught?.code !== undefined && /^E[A-Z0-9]+$/.test(caught.code)) message = `${caught.syscall ?? 'a file operation'}${caught.path === undefined ? '' : ` ${printable(caught.path)}`} failed: ${caught.code}`;
    else message = `unexpected ${caught?.name ?? 'error'}: ${printable(String(caught?.message)).slice(0, 200)}`;
    return { code: 2, stdout: '', stderr: redact(`setup-check: failed: ${message}\n`, secrets) };
  }
}

// Runs only when this file is the program, also when it is reached through a symbolic link.
function isMain() {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const { code, stdout, stderr } = await runCli(process.argv.slice(2), process.env);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = code;
}
